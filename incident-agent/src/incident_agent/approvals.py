"""Human-in-the-loop approval boundary for operational write actions.

Invariants (enforced here and covered by tests/test_approvals.py):

1. The agent can only *propose*. Nothing in the tool executor can execute.
2. Execution requires a signed operator token whose role, environment and
   service scope cover the proposal.
3. The approver must echo the proposal's params_hash, proving they approved
   the exact action shown (no swap between display and execution).
4. Proposals expire; expired, rejected or already-executed proposals can't run.
5. Every state change is written to a hash-chained, append-only audit log.

The model is never the security boundary: these checks don't read anything
the model produced except the proposal parameters, which are re-validated
against the environment before a proposal is created.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from pathlib import Path
from typing import Any

import jwt

from .lab.scenario import Scenario

WRITE_ACTIONS = ("restart_service", "rollback_deployment")
DEFAULT_TTL = timedelta(minutes=15)
SANDBOX_ENV = "sandbox"


class ProposalStatus(StrEnum):
    PENDING = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"


class ApprovalError(Exception):
    """Raised with an HTTP-ish status so the API layer can map it."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code


class ProposalRejected(ValueError):
    """Proposal parameters failed validation; returned to the model as a tool error."""


# ---------------------------------------------------------------- identity


@dataclass(frozen=True)
class Principal:
    sub: str
    role: str  # viewer | operator | admin
    env: str
    services: tuple[str, ...]

    def can_approve(self, service: str, env: str) -> bool:
        return (
            self.role in ("operator", "admin")
            and self.env == env
            and ("*" in self.services or service in self.services)
        )


class TokenAuthority:
    """Issues and verifies short-lived HS256 operator tokens.

    Production would verify tokens from the company IdP (OIDC) instead; the
    authorization checks downstream are the same.
    """

    def __init__(self, secret: str, issuer: str = "incident-agent"):
        if len(secret) < 32:
            raise ValueError("approval signing secret must be at least 32 characters")
        self._secret = secret
        self._issuer = issuer

    def issue(self, sub: str, role: str, services: list[str], env: str = SANDBOX_ENV,
              ttl: timedelta = timedelta(minutes=15), extra: dict[str, Any] | None = None) -> str:
        now = datetime.now(UTC)
        claims = {
            "iss": self._issuer,
            "sub": sub,
            "role": role,
            "env": env,
            "services": services,
            "iat": now,
            "exp": now + ttl,
            "jti": secrets.token_hex(8),
            **(extra or {}),
        }
        return jwt.encode(claims, self._secret, algorithm="HS256")

    def verify(self, token: str) -> Principal:
        try:
            claims = jwt.decode(token, self._secret, algorithms=["HS256"], issuer=self._issuer,
                                options={"require": ["exp", "sub", "role", "env"]})
        except jwt.ExpiredSignatureError as e:
            raise ApprovalError(401, "token_expired", "operator token has expired") from e
        except jwt.PyJWTError as e:
            raise ApprovalError(401, "invalid_token", "operator token is invalid") from e
        return Principal(
            sub=claims["sub"], role=claims["role"], env=claims["env"],
            services=tuple(claims.get("services", [])),
        )


# ---------------------------------------------------------------- storage


def _canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def _params_hash(action: str, args: dict[str, Any], investigation_id: str) -> str:
    return hashlib.sha256(_canonical({"action": action, "args": args, "investigation_id": investigation_id}).encode()).hexdigest()


class Store:
    """SQLite persistence for proposals and the audit chain."""

    def __init__(self, path: str | Path = ":memory:"):
        self._lock = threading.Lock()
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(
            """
            CREATE TABLE IF NOT EXISTS proposals (
              id TEXT PRIMARY KEY, investigation_id TEXT, body TEXT, status TEXT,
              created_at REAL, expires_at REAL
            );
            CREATE TABLE IF NOT EXISTS audit (
              seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, investigation_id TEXT,
              actor TEXT, event TEXT, data TEXT, prev_hash TEXT, hash TEXT
            );
            """
        )

    def put_proposal(self, p: dict[str, Any]) -> None:
        with self._lock:
            self._db.execute(
                "INSERT OR REPLACE INTO proposals VALUES (?,?,?,?,?,?)",
                (p["id"], p["investigation_id"], _canonical(p), p["status"], p["created_at"], p["expires_at"]),
            )
            self._db.commit()

    def get_proposal(self, pid: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._db.execute("SELECT body FROM proposals WHERE id=?", (pid,)).fetchone()
        return json.loads(row["body"]) if row else None

    def proposals_for(self, investigation_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._db.execute(
                "SELECT body FROM proposals WHERE investigation_id=? ORDER BY created_at", (investigation_id,)
            ).fetchall()
        return [json.loads(r["body"]) for r in rows]

    def append_audit(self, investigation_id: str, actor: str, event: str, data: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            last = self._db.execute("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1").fetchone()
            prev = last["hash"] if last else "0" * 64
            ts = datetime.now(UTC).isoformat()
            payload = _canonical({"ts": ts, "investigation_id": investigation_id, "actor": actor,
                                  "event": event, "data": data, "prev_hash": prev})
            digest = hashlib.sha256(payload.encode()).hexdigest()
            cur = self._db.execute(
                "INSERT INTO audit (ts, investigation_id, actor, event, data, prev_hash, hash) VALUES (?,?,?,?,?,?,?)",
                (ts, investigation_id, actor, event, _canonical(data), prev, digest),
            )
            self._db.commit()
            return {"seq": cur.lastrowid, "ts": ts, "actor": actor, "event": event, "data": data, "hash": digest}

    def audit_events(self, investigation_id: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            if investigation_id:
                rows = self._db.execute("SELECT * FROM audit WHERE investigation_id=? ORDER BY seq",
                                        (investigation_id,)).fetchall()
            else:
                rows = self._db.execute("SELECT * FROM audit ORDER BY seq").fetchall()
        return [dict(r) | {"data": json.loads(r["data"])} for r in rows]

    def verify_audit_chain(self) -> bool:
        prev = "0" * 64
        for r in self.audit_events():
            payload = _canonical({"ts": r["ts"], "investigation_id": r["investigation_id"], "actor": r["actor"],
                                  "event": r["event"], "data": r["data"], "prev_hash": prev})
            if r["prev_hash"] != prev or hashlib.sha256(payload.encode()).hexdigest() != r["hash"]:
                return False
            prev = r["hash"]
        return True


# ---------------------------------------------------------------- sandbox


class SandboxInfra:
    """Simulated deployment target. The only thing approved actions can touch."""

    def __init__(self, scenario: Scenario):
        self.scenario = scenario
        self.state = {name: {"version": node.version, "instances": node.instances} for name, node in scenario.topology.items()}

    def execute(self, action: str, args: dict[str, Any]) -> dict[str, Any]:
        service = args["service"]
        if action == "rollback_deployment":
            before = self.state[service]["version"]
            self.state[service]["version"] = args["target_version"]
            result = {"service": service, "from_version": before, "to_version": args["target_version"]}
        else:
            result = {"service": service, "instances_restarted": self.state[service]["instances"]}
        resolves = any(
            a.type.value == action and a.service == service and (not a.target_version or a.target_version == args.get("target_version"))
            for a in self.scenario.ground_truth.acceptable_actions
        )
        result["post_action_check"] = (
            "alert condition cleared within 4 minutes" if resolves
            else "no improvement observed; alert still firing"
        )
        return result


# ---------------------------------------------------------------- service


def assess_risk(scenario: Scenario, action: str, args: dict[str, Any]) -> dict[str, Any]:
    node = scenario.topology[args["service"]]
    dependents = sorted(n for n, s in scenario.topology.items() if args["service"] in s.depends_on)
    level = "high" if node.tier == 1 else "medium" if node.tier == 2 else "low"
    impact = (
        f"Rolling restart of {node.instances} instances; in-flight requests may be dropped."
        if action == "restart_service"
        else f"Redeploy {node.instances} instances at {args.get('target_version')}; changes since then are reverted."
    )
    return {"level": level, "tier": node.tier, "instances": node.instances, "dependents": dependents, "impact": impact}


class ApprovalService:
    def __init__(self, store: Store, tokens: TokenAuthority, ttl: timedelta = DEFAULT_TTL,
                 clock: Callable[[], float] = time.time):
        self.store = store
        self.tokens = tokens
        self.ttl = ttl
        self.clock = clock
        self._sandboxes: dict[str, SandboxInfra] = {}

    # -- called by the tool executor (agent side) -------------------------
    def propose(self, *, investigation_id: str, scenario: Scenario, action: str, args: dict[str, Any],
                proposer: str) -> dict[str, Any]:
        if action not in WRITE_ACTIONS:
            raise ProposalRejected(f"{action} is not an allowlisted write action")
        service = args.get("service", "")
        if service not in scenario.topology:
            raise ProposalRejected(f"unknown service '{service}'")
        if action == "rollback_deployment":
            target = args.get("target_version", "")
            known = {c.previous_version for c in scenario.changes if c.service == service and c.previous_version}
            if target not in known:
                raise ProposalRejected(
                    f"target_version '{target}' is not a previous version of {service} in change history"
                    + (f"; known previous versions: {sorted(known)}" if known else "; no rollback targets recorded")
                )
        if len(self.store.proposals_for(investigation_id)) >= 2:
            raise ProposalRejected("proposal limit reached for this investigation (max 2)")

        now = self.clock()
        clean_args = {k: args[k] for k in sorted(args)}
        proposal = {
            "id": "act_" + secrets.token_hex(6),
            "investigation_id": investigation_id,
            "scenario_id": scenario.id,
            "env": SANDBOX_ENV,
            "action": action,
            "args": clean_args,
            "reason": args.get("reason", ""),
            "risk": assess_risk(scenario, action, args),
            "proposer": proposer,
            "status": ProposalStatus.PENDING.value,
            "params_hash": _params_hash(action, clean_args, investigation_id),
            "created_at": now,
            "expires_at": now + self.ttl.total_seconds(),
        }
        self.store.put_proposal(proposal)
        self._sandboxes.setdefault(investigation_id, SandboxInfra(scenario))
        self.store.append_audit(investigation_id, proposer, "action.proposed",
                                {"proposal_id": proposal["id"], "action": action, "args": proposal["args"]})
        return proposal

    # -- called by the API (human side) ------------------------------------
    def _authorize(self, proposal_id: str, token: str | None, params_hash: str | None) -> tuple[dict[str, Any], Principal]:
        if not token:
            raise ApprovalError(401, "missing_token", "operator token required")
        principal = self.tokens.verify(token)
        proposal = self.store.get_proposal(proposal_id)
        if not proposal:
            raise ApprovalError(404, "not_found", "proposal not found")
        if principal.sub.startswith("agent:"):
            raise ApprovalError(403, "self_approval", "agents cannot approve actions")
        if not principal.can_approve(proposal["args"]["service"], proposal["env"]):
            self.store.append_audit(proposal["investigation_id"], principal.sub, "action.denied",
                                    {"proposal_id": proposal_id, "reason": "insufficient_permission", "role": principal.role})
            raise ApprovalError(403, "forbidden", f"{principal.sub} may not act on {proposal['args']['service']} in {proposal['env']}")
        if proposal["status"] != ProposalStatus.PENDING.value:
            raise ApprovalError(409, "not_pending", f"proposal is {proposal['status']}")
        if self.clock() > proposal["expires_at"]:
            self.store.append_audit(proposal["investigation_id"], principal.sub, "action.expired", {"proposal_id": proposal_id})
            raise ApprovalError(410, "expired", "proposal has expired; re-run the investigation")
        if params_hash != proposal["params_hash"]:
            raise ApprovalError(409, "params_mismatch", "params_hash does not match the pending proposal")
        if _params_hash(proposal["action"], proposal["args"], proposal["investigation_id"]) != proposal["params_hash"]:
            # stored parameters no longer match what was proposed and shown - refuse, never "fix up"
            self.store.append_audit(proposal["investigation_id"], principal.sub, "action.integrity_failure",
                                    {"proposal_id": proposal_id})
            raise ApprovalError(409, "integrity_failure", "proposal parameters changed after creation")
        return proposal, principal

    def approve(self, proposal_id: str, token: str | None, params_hash: str | None) -> dict[str, Any]:
        proposal, principal = self._authorize(proposal_id, token, params_hash)
        inv = proposal["investigation_id"]
        proposal["status"] = ProposalStatus.APPROVED.value
        proposal["approved_by"] = principal.sub
        self.store.put_proposal(proposal)
        self.store.append_audit(inv, principal.sub, "action.approved", {"proposal_id": proposal_id})

        sandbox = self._sandboxes.get(inv)
        if sandbox is None:
            proposal["status"] = ProposalStatus.FAILED.value
            self.store.put_proposal(proposal)
            self.store.append_audit(inv, "system", "action.failed", {"proposal_id": proposal_id, "reason": "sandbox unavailable"})
            raise ApprovalError(503, "sandbox_unavailable", "execution target unavailable")
        result = sandbox.execute(proposal["action"], proposal["args"])
        proposal["status"] = ProposalStatus.EXECUTED.value
        proposal["execution"] = result
        self.store.put_proposal(proposal)
        self.store.append_audit(inv, "system", "action.executed", {"proposal_id": proposal_id, "result": result})
        return proposal

    def reject(self, proposal_id: str, token: str | None, params_hash: str | None, reason: str = "") -> dict[str, Any]:
        proposal, principal = self._authorize(proposal_id, token, params_hash)
        proposal["status"] = ProposalStatus.REJECTED.value
        proposal["rejected_by"] = principal.sub
        self.store.put_proposal(proposal)
        self.store.append_audit(proposal["investigation_id"], principal.sub, "action.rejected",
                                {"proposal_id": proposal_id, "reason": reason[:500]})
        return proposal

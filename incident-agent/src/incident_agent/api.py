"""HTTP API for the incident agent.

Public-demo posture: visitors can only pick a seeded scenario (no free-text
prompts), live model runs are off unless DEMO_LIVE_ENABLED=true, and live runs
are capped per session, per IP and per day on top of the gateway's own budget.
"""

from __future__ import annotations

import logging
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .agent import Investigator
from .approvals import ApprovalError, ApprovalService, Principal, Store, TokenAuthority
from .config import Settings, get_settings
from .lab.scenario import load_scenarios
from .model_client import AnthropicModelClient, ModelClient, ScriptedModelClient
from .schemas import TraceEvent

log = logging.getLogger("incident_agent.api")


class SlidingWindowLimiter:
    """In-process limiter. A multi-instance deployment would move this to Redis."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_s: float) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


class StartInvestigation(BaseModel):
    scenario_id: str = Field(max_length=80)
    variant: Literal["base", "abstain"] = "base"
    fault: str = Field(default="", max_length=60)
    client: Literal["scripted", "claude"] = "scripted"


class Decision(BaseModel):
    params_hash: str = Field(min_length=64, max_length=64)
    reason: str = Field(default="", max_length=500)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    if len(settings.approval_signing_secret) < 32:
        raise RuntimeError("APPROVAL_SIGNING_SECRET must be set (>= 32 chars)")
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    scenarios = load_scenarios()
    tokens = TokenAuthority(settings.approval_signing_secret)
    store = Store(settings.data_dir / "incident-agent.db")
    approvals = ApprovalService(store, tokens)
    limiter = SlidingWindowLimiter()
    runs: dict[str, dict[str, Any]] = {}
    session_live_runs: dict[str, int] = defaultdict(int)

    app = FastAPI(title="Incident Response Agent", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ApprovalError)
    async def approval_error(_: Request, exc: ApprovalError):
        return JSONResponse(status_code=exc.status, content={"error": exc.code, "message": str(exc)})

    def client_ip(request: Request) -> str:
        fwd = request.headers.get("x-forwarded-for")
        return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")

    def principal(authorization: str | None = Header(default=None)) -> Principal:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise ApprovalError(401, "missing_token", "bearer token required")
        return tokens.verify(authorization.split(" ", 1)[1])

    def bearer(authorization: str | None = Header(default=None)) -> str | None:
        if authorization and authorization.lower().startswith("bearer "):
            return authorization.split(" ", 1)[1]
        return None

    # ------------------------------------------------------------ public
    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "scenarios": len(scenarios), "live_model_runs": settings.demo_live_enabled,
                "model_configured": settings.has_model_credentials()}

    @app.get("/scenarios")
    def list_scenarios() -> list[dict[str, Any]]:
        return [s.public_view() for s in scenarios.values()]

    @app.post("/demo/session")
    def demo_session(request: Request) -> dict[str, Any]:
        ip = client_ip(request)
        if not limiter.allow(f"session:{ip}", settings.demo_sessions_per_ip_per_hour, 3600):
            raise HTTPException(429, "demo session limit reached for this address; try again later")
        sid = "demo_" + secrets.token_hex(6)
        token = tokens.issue(sub=sid, role="operator", services=["*"], env="sandbox",
                             ttl=timedelta(minutes=20), extra={"demo": True})
        return {"token": token, "session_id": sid, "env": "sandbox", "expires_in_s": 1200,
                "live_runs_allowed": settings.demo_live_runs_per_session if settings.demo_live_enabled else 0}

    # ------------------------------------------------------ investigations
    @app.post("/investigations", status_code=202)
    def start(body: StartInvestigation, request: Request, who: Principal = Depends(principal)) -> dict[str, Any]:
        scenario = scenarios.get(body.scenario_id)
        if not scenario:
            raise HTTPException(404, "unknown scenario")
        if body.variant == "abstain":
            if not scenario.abstain_variant:
                raise HTTPException(400, "scenario has no evidence-removed variant")
            scenario = scenario.with_evidence_removed()
        faults = []
        if body.fault:
            fv = next((f for f in scenario.fault_variants if f.name == body.fault), None)
            if not fv:
                raise HTTPException(400, "unknown fault variant")
            faults = fv.faults

        if not limiter.allow(f"inv:{client_ip(request)}", 10, 3600):
            raise HTTPException(429, "investigation limit reached for this address")
        client: ModelClient
        if body.client == "claude":
            if not settings.demo_live_enabled or not settings.has_model_credentials():
                raise HTTPException(403, "live model runs are disabled; recorded runs are available on the site")
            if session_live_runs[who.sub] >= settings.demo_live_runs_per_session:
                raise HTTPException(429, "live run limit reached for this session")
            if not limiter.allow("live:global", settings.demo_daily_live_runs, 86400):
                raise HTTPException(429, "daily live run budget exhausted")
            session_live_runs[who.sub] += 1
            api_key, base_url = settings.model_credentials()
            client = AnthropicModelClient(settings.model, api_key=api_key, base_url=base_url)
        else:
            client = ScriptedModelClient(scenario.alert.service)

        inv_id = "inv_" + secrets.token_hex(6)
        state: dict[str, Any] = {"id": inv_id, "owner": who.sub, "status": "running", "events": [], "result": None}
        runs[inv_id] = state

        def on_event(ev: TraceEvent) -> None:
            state["events"].append(ev.model_dump(mode="json"))

        def work() -> None:
            try:
                result = Investigator(client, approvals, effort=settings.effort).run(
                    scenario, variant=body.variant, faults=faults, investigation_id=inv_id, on_event=on_event)
                state["result"] = result.model_dump(mode="json", exclude={"trace"})
                state["status"] = "completed"
            except Exception:  # never leak internals to the client
                log.exception("investigation %s failed", inv_id)
                state["status"] = "failed"

        threading.Thread(target=work, daemon=True).start()
        return {"investigation_id": inv_id, "status": "running"}

    @app.get("/investigations/{inv_id}")
    def get_investigation(inv_id: str, who: Principal = Depends(principal)) -> dict[str, Any]:
        state = runs.get(inv_id)
        if not state or state["owner"] != who.sub:
            raise HTTPException(404, "not found")
        return state | {"proposals": store.proposals_for(inv_id)}

    @app.get("/investigations/{inv_id}/audit")
    def audit(inv_id: str, who: Principal = Depends(principal)) -> dict[str, Any]:
        state = runs.get(inv_id)
        if not state or state["owner"] != who.sub:
            raise HTTPException(404, "not found")
        return {"events": store.audit_events(inv_id), "chain_valid": store.verify_audit_chain()}

    # ------------------------------------------------------------- actions
    @app.get("/actions/{proposal_id}")
    def get_action(proposal_id: str, _: Principal = Depends(principal)) -> dict[str, Any]:
        p = store.get_proposal(proposal_id)
        if not p:
            raise HTTPException(404, "not found")
        return p

    def demo_scope(proposal_id: str, token: str | None) -> None:
        """Demo sessions are operators only for their own investigations."""
        if not token:
            return  # ApprovalService rejects with 401
        who = tokens.verify(token)
        if who.sub.startswith("demo_"):
            p = store.get_proposal(proposal_id)
            owner = runs.get(p["investigation_id"], {}).get("owner") if p else None
            if p and owner != who.sub:
                raise ApprovalError(403, "forbidden", "demo sessions can only act on their own investigations")

    @app.post("/actions/{proposal_id}/approve")
    def approve(proposal_id: str, body: Decision, token: str | None = Depends(bearer)) -> dict[str, Any]:
        demo_scope(proposal_id, token)
        return approvals.approve(proposal_id, token, body.params_hash)

    @app.post("/actions/{proposal_id}/reject")
    def reject(proposal_id: str, body: Decision, token: str | None = Depends(bearer)) -> dict[str, Any]:
        demo_scope(proposal_id, token)
        return approvals.reject(proposal_id, token, body.params_hash, body.reason)

    app.state.approvals = approvals
    app.state.tokens = tokens
    return app

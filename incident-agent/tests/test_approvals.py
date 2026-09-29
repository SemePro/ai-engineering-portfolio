"""The approval boundary. These tests are the evidence behind the claim
'unauthorized write execution is impossible'."""

from __future__ import annotations

from datetime import timedelta

import pytest

from incident_agent.agent import Investigator
from incident_agent.approvals import ApprovalError, ApprovalService, ProposalRejected, TokenAuthority
from incident_agent.tools import ToolExecutor

from .conftest import SECRET, ScriptClient, final_findings

ROLLBACK = {"service": "checkout-api", "target_version": "v2.14.6", "reason": "deploy v2.14.7 shrank the pool"}


def propose(approvals, scenario, inv="inv_test", **args):
    return approvals.propose(investigation_id=inv, scenario=scenario, action="rollback_deployment",
                             args=args or ROLLBACK, proposer="agent:test-model")


def operator(tokens, **kw):
    params = {"sub": "alice@oncall", "role": "operator", "services": ["checkout-api"], "env": "sandbox"} | kw
    return tokens.issue(**params)


def test_agent_tool_call_creates_proposal_but_never_executes(approvals, store, checkout):
    ex = ToolExecutor(checkout, "inv_1", approvals, proposer="agent:m")
    out = ex.execute("rollback_deployment", "toolu_1", ROLLBACK)
    assert not out.is_error
    assert '"executed": false' in out.content
    assert out.proposal["status"] == "pending_approval"
    assert [e["event"] for e in store.audit_events()] == ["action.proposed"]


def test_full_investigation_never_executes_actions(approvals, store, checkout):
    client = ScriptClient([
        [("rollback_deployment", ROLLBACK)],
        final_findings(),
    ])
    Investigator(client, approvals).run(checkout)
    assert not any(e["event"] == "action.executed" for e in store.audit_events())


def test_operator_approval_executes_and_is_audited(approvals, store, tokens, checkout):
    p = propose(approvals, checkout)
    done = approvals.approve(p["id"], operator(tokens), p["params_hash"])
    assert done["status"] == "executed"
    assert done["execution"]["to_version"] == "v2.14.6"
    assert "cleared" in done["execution"]["post_action_check"]
    events = [e["event"] for e in store.audit_events()]
    assert events == ["action.proposed", "action.approved", "action.executed"]
    assert store.verify_audit_chain()


@pytest.mark.parametrize(
    "token_kwargs, status, code",
    [
        (None, 401, "missing_token"),
        ({"role": "viewer"}, 403, "forbidden"),
        ({"env": "production"}, 403, "forbidden"),
        ({"services": ["payments-gateway"]}, 403, "forbidden"),
        ({"sub": "agent:claude-opus-5-5"}, 403, "self_approval"),
    ],
)
def test_unauthorized_approvals_are_refused(approvals, store, tokens, checkout, token_kwargs, status, code):
    p = propose(approvals, checkout)
    token = None if token_kwargs is None else operator(tokens, **token_kwargs)
    with pytest.raises(ApprovalError) as err:
        approvals.approve(p["id"], token, p["params_hash"])
    assert (err.value.status, err.value.code) == (status, code)
    assert store.get_proposal(p["id"])["status"] == "pending_approval"
    assert not any(e["event"] == "action.executed" for e in store.audit_events())


def test_forged_and_expired_tokens_are_refused(approvals, tokens, checkout):
    p = propose(approvals, checkout)
    forged = TokenAuthority("another-secret-another-secret-12345").issue("mallory", "admin", ["*"])
    expired = tokens.issue("alice", "operator", ["*"], ttl=timedelta(seconds=-5))
    for token, code in ((forged, "invalid_token"), (expired, "token_expired"), ("not.a.jwt", "invalid_token")):
        with pytest.raises(ApprovalError) as err:
            approvals.approve(p["id"], token, p["params_hash"])
        assert err.value.code == code


def test_params_hash_must_match_what_the_human_saw(approvals, tokens, checkout):
    p = propose(approvals, checkout)
    with pytest.raises(ApprovalError) as err:
        approvals.approve(p["id"], operator(tokens), "0" * 64)
    assert err.value.code == "params_mismatch"


def test_expired_proposal_cannot_be_approved(store, tokens, checkout):
    now = [1000.0]
    svc = ApprovalService(store, tokens, ttl=timedelta(minutes=15), clock=lambda: now[0])
    p = propose(svc, checkout)
    now[0] += 16 * 60
    with pytest.raises(ApprovalError) as err:
        svc.approve(p["id"], operator(tokens), p["params_hash"])
    assert (err.value.status, err.value.code) == (410, "expired")


def test_proposal_cannot_run_twice_or_after_rejection(approvals, tokens, checkout):
    p = propose(approvals, checkout)
    approvals.approve(p["id"], operator(tokens), p["params_hash"])
    with pytest.raises(ApprovalError) as err:
        approvals.approve(p["id"], operator(tokens), p["params_hash"])
    assert err.value.code == "not_pending"

    q = propose(approvals, checkout, inv="inv_other")
    approvals.reject(q["id"], operator(tokens), q["params_hash"], "not convinced")
    with pytest.raises(ApprovalError):
        approvals.approve(q["id"], operator(tokens), q["params_hash"])


@pytest.mark.parametrize(
    "action, args, fragment",
    [
        ("rollback_deployment", {"service": "checkout-api", "target_version": "v0.0.1", "reason": "x" * 12}, "not a previous version"),
        ("rollback_deployment", {"service": "payments-api", "target_version": "v1", "reason": "x" * 12}, "unknown service"),
        ("drop_database", {"service": "orders-db", "reason": "x" * 12}, "not an allowlisted"),
    ],
)
def test_proposals_are_validated_against_the_environment(approvals, checkout, action, args, fragment):
    with pytest.raises(ProposalRejected) as err:
        approvals.propose(investigation_id="inv", scenario=checkout, action=action, args=args, proposer="agent:m")
    assert fragment in str(err.value)


def test_proposal_limit_per_investigation(approvals, checkout):
    propose(approvals, checkout)
    approvals.propose(investigation_id="inv_test", scenario=checkout, action="restart_service",
                      args={"service": "checkout-api", "reason": "x" * 12}, proposer="agent:m")
    with pytest.raises(ProposalRejected):
        approvals.propose(investigation_id="inv_test", scenario=checkout, action="restart_service",
                          args={"service": "orders-db", "reason": "x" * 12}, proposer="agent:m")


def test_audit_chain_detects_tampering(approvals, store, tokens, checkout):
    p = propose(approvals, checkout)
    approvals.approve(p["id"], operator(tokens), p["params_hash"])
    assert store.verify_audit_chain()
    store._db.execute("UPDATE audit SET actor='someone-else' WHERE event='action.approved'")
    assert not store.verify_audit_chain()


def test_signing_secret_must_be_strong():
    with pytest.raises(ValueError):
        TokenAuthority("short")
    TokenAuthority(SECRET)

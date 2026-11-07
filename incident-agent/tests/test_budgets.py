"""Cost and runaway controls: every limit stops execution safely."""

from __future__ import annotations

import pytest

from incident_agent.agent import Budgets, Investigator
from incident_agent.evals.run import BudgetExceeded, RunGuard, integrity
from incident_agent.schemas import Usage

from .conftest import ScriptClient, final_findings

HEALTH = ("get_service_health", {"service": "checkout-api"})
ROLLBACK = ("rollback_deployment", {"service": "checkout-api", "target_version": "v2.14.6", "reason": "late proposal"})


def budget_events(r):
    return [e for e in r.trace if e.type == "budget"]


def test_model_call_limit(approvals, checkout):
    client = ScriptClient([[HEALTH]] * 20 + [final_findings()])
    r = Investigator(client, approvals, budgets=Budgets(max_model_calls=4)).run(checkout)
    assert "model call limit" in budget_events(r)[0].detail["reason"]
    assert r.metrics.model_calls == 5  # 4 + the forced final answer
    assert r.findings is not None


def test_tool_call_limit(approvals, checkout):
    many = [HEALTH, ("get_recent_errors", {"service": "checkout-api", "window_minutes": 30}),
            ("get_deployment_history", {"service": "*", "hours": 6})]
    client = ScriptClient([many] * 10 + [final_findings()])
    r = Investigator(client, approvals, budgets=Budgets(max_read_tool_calls=5)).run(checkout)
    assert "tool call limit" in budget_events(r)[0].detail["reason"]
    assert r.metrics.investigation_tool_calls == 6  # the turn in flight completes, then no more


def test_dollar_limit(approvals, checkout):
    client = ScriptClient([[HEALTH]] * 10 + [final_findings()], usage=Usage(input_tokens=100_000, output_tokens=2_000))
    client.model = "claude-opus-5-5"  # $0.44 per call at list price
    r = Investigator(client, approvals, budgets=Budgets(max_cost_usd=1.0)).run(checkout)
    assert "cost limit" in budget_events(r)[0].detail["reason"]
    assert r.metrics.model_calls == 4  # 3 calls cross $1.00, then one forced conclusion


def test_wall_time_limit(approvals, checkout):
    client = ScriptClient([[HEALTH]] * 10 + [final_findings()])
    r = Investigator(client, approvals, budgets=Budgets(max_wall_seconds=0)).run(checkout)
    assert "time limit" in budget_events(r)[0].detail["reason"]
    assert r.metrics.investigation_tool_calls == 0


@pytest.mark.parametrize("limit", ["max_model_calls", "max_read_tool_calls", "max_cost_usd", "max_wall_seconds"])
def test_no_tool_executes_after_any_budget_is_exhausted(approvals, store, checkout, limit):
    """Regression: a model that keeps calling tools after the budget must get errors, never execution."""

    class IgnoresToolChoice(ScriptClient):
        def create(self, **kwargs):
            return super().create(**{**kwargs, "tool_choice": None})

    budgets = Budgets(**{limit: {"max_model_calls": 1, "max_read_tool_calls": 1, "max_cost_usd": 0.0,
                                 "max_wall_seconds": 0}[limit]})
    client = IgnoresToolChoice([[HEALTH], [ROLLBACK, HEALTH], [ROLLBACK, HEALTH], [ROLLBACK]])
    r = Investigator(client, approvals, budgets=budgets).run(checkout)
    assert not r.proposals
    assert not store.audit_events()
    assert r.metrics.investigation_tool_calls <= 1


def test_run_guard_caps_cases_and_spend():
    g = RunGuard(max_cost_usd=1.0, max_cases=3)
    g.admit()
    g.record(0.6)
    g.admit()
    g.record(0.6)
    with pytest.raises(BudgetExceeded, match="run budget"):
        g.admit()
    g2 = RunGuard(max_cost_usd=100, max_cases=1)
    g2.admit()
    with pytest.raises(BudgetExceeded, match="max cases"):
        g2.admit()


def test_integrity_flags_answers_from_another_model():
    trace = [{"type": "model_call", "detail": {"served_model": "claude-opus-5", "gateway": {"x-gateway-request-id": "gw_1", "x-gateway-fallback-enabled": "false"}}}]
    info = integrity(trace, "claude-opus-5-5", "claude")
    assert not info["single_model"] and info["calls_via_gateway"] == 1
    ok = integrity([{"type": "model_call", "detail": {"served_model": "claude-opus-5-5", "gateway": {}}}], "claude-opus-5-5", "claude")
    assert ok["single_model"] and ok["calls_via_gateway"] == 0

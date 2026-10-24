from __future__ import annotations

import json

from incident_agent.agent import TOOLS, Budgets, Investigator
from incident_agent.model_client import MalformedOutputClient, ModelUnavailable, ScriptedModelClient
from incident_agent.prompts import SYSTEM_PROMPT
from incident_agent.schemas import InvestigationStatus, Usage

from .conftest import ScriptClient, final_findings

HEALTH = ("get_service_health", {"service": "checkout-api"})


def test_trace_records_the_investigation(approvals, checkout):
    r = Investigator(ScriptedModelClient("checkout-api"), approvals).run(checkout)
    types = [e.type for e in r.trace]
    assert types[0] == "alert"
    assert types.count("tool_call") == 4 and "findings" in types
    assert r.metrics.investigation_tool_calls == 4
    assert all(e.seq == i for i, e in enumerate(r.trace))


def test_cached_prefix_is_identical_across_incidents(approvals, scenarios):
    """Prompt caching only works if tools + system are byte-identical for every
    incident; per-incident data must live in the first user message."""
    seen = []
    for sid in ("inc-01-checkout-pool-saturation", "inc-08-retry-storm"):
        client = ScriptClient([final_findings()])
        Investigator(client, approvals).run(scenarios[sid])
        call = client.calls[0]
        seen.append(json.dumps([call["system"], call["tools"]], sort_keys=False))
        assert scenarios[sid].alert.id in call["messages"][0]["content"]
        assert scenarios[sid].alert.id not in call["system"]
    assert seen[0] == seen[1]
    assert json.dumps(TOOLS) == json.dumps(TOOLS)


def test_caching_flag_is_passed_through(approvals, checkout):
    for caching in (True, False):
        client = ScriptClient([final_findings()])
        Investigator(client, approvals).run(checkout, caching=caching)
        assert client.calls[0]["caching"] is caching


def test_budget_forces_final_answer_without_tools(approvals, checkout):
    client = ScriptClient([[HEALTH]] * 10 + [final_findings()])
    r = Investigator(client, approvals, budgets=Budgets(max_model_calls=3)).run(checkout)
    assert r.findings is not None
    assert any(e.type == "budget" for e in r.trace)
    assert client.calls[-1]["tool_choice"] == {"type": "none"}
    assert client.calls[-1]["messages"][-1]["role"] == "system"


def test_cost_budget(approvals, checkout):
    client = ScriptClient([[HEALTH]] * 10 + [final_findings()], usage=Usage(input_tokens=200_000, output_tokens=5_000))
    client.model = "claude-opus-5-5"
    r = Investigator(client, approvals, budgets=Budgets(max_cost_usd=1.0)).run(checkout)
    assert any(e.type == "budget" and "cost" in e.detail["reason"] for e in r.trace)
    assert r.metrics.model_calls <= 3


def test_malformed_final_answer_is_repaired_once(approvals, checkout):
    client = MalformedOutputClient(ScriptedModelClient("checkout-api"))
    r = Investigator(client, approvals).run(checkout)
    assert r.findings is not None
    assert any(e.type == "guardrail" and "repair" in e.title for e in r.trace)


def test_persistently_invalid_output_yields_no_conclusion(approvals, checkout):
    client = ScriptClient(["{not json", '{"status": "maybe"}'])
    r = Investigator(client, approvals).run(checkout)
    assert r.findings is None and "invalid findings" in r.findings_error


def test_out_of_range_confidence_is_rejected(approvals, checkout):
    client = ScriptClient([final_findings(confidence=1.7), final_findings(confidence=1.7)])
    r = Investigator(client, approvals).run(checkout)
    assert r.findings is None


def test_model_outage_stops_safely(approvals, checkout):
    class Down:
        label, model = "down", "m"

        def create(self, **_):
            raise ModelUnavailable("gateway budget exceeded", 429)

    r = Investigator(Down(), approvals).run(checkout)
    assert r.findings is None and "model unavailable" in r.findings_error
    assert r.trace[-1].type == "error"


def test_fabricated_citations_are_flagged(approvals, checkout):
    client = ScriptClient([[HEALTH], final_findings(evidence=[{"tool_call_id": "toolu_made_up", "finding": "x"}])])
    r = Investigator(client, approvals).run(checkout)
    assert any(e.type == "guardrail" and "cite" in e.title for e in r.trace)


def test_action_with_insufficient_evidence_is_flagged(approvals, checkout):
    rollback = ("rollback_deployment", {"service": "checkout-api", "target_version": "v2.14.6", "reason": "guessing here"})
    client = ScriptClient([[rollback], final_findings(status="insufficient_evidence",
                                                     root_cause={"category": "unknown", "service": "", "summary": ""})])
    r = Investigator(client, approvals).run(checkout)
    assert r.findings.status == InvestigationStatus.INSUFFICIENT_EVIDENCE
    assert any(e.type == "guardrail" and "insufficient" in e.title for e in r.trace)


def test_hypothesis_ledger_is_traced_not_counted_as_investigation(approvals, checkout):
    ledger = ("update_hypotheses", {"hypotheses": [{"id": "H1", "statement": "pool exhausted", "status": "active",
                                                    "confidence": 0.6, "evidence_refs": []}], "next_step": "check deploys"})
    client = ScriptClient([[HEALTH, ledger], final_findings()])
    r = Investigator(client, approvals).run(checkout)
    assert r.metrics.ledger_updates == 1 and r.metrics.investigation_tool_calls == 1
    assert r.hypotheses[0].id == "H1"
    assert any(e.type == "hypotheses" for e in r.trace)


def test_parallel_tool_results_return_in_one_message(approvals, checkout):
    client = ScriptClient([[HEALTH, ("get_deployment_history", {"service": "*", "hours": 6})], final_findings()])
    Investigator(client, approvals).run(checkout)
    results = client.calls[1]["messages"][-1]
    assert results["role"] == "user" and len(results["content"]) == 2


def test_system_prompt_has_no_volatile_content():
    for marker in ("2026-", "ALRT-", "inv_", "{", "}"):
        assert marker not in SYSTEM_PROMPT


def test_tool_calls_after_budget_are_never_executed(approvals, store, checkout):
    """Even if a model ignored tool_choice=none, nothing runs after the budget."""
    rollback = ("rollback_deployment", {"service": "checkout-api", "target_version": "v2.14.6", "reason": "late proposal"})

    class Rogue(ScriptClient):
        def create(self, **kwargs):
            kwargs = {**kwargs, "tool_choice": None}
            return super().create(**kwargs)

    client = Rogue([[HEALTH], [HEALTH], [rollback], [rollback], [rollback]])
    r = Investigator(client, approvals, budgets=Budgets(max_model_calls=2)).run(checkout)
    assert not r.proposals and not store.audit_events()
    assert any(e.type == "guardrail" and "not executed" in e.title for e in r.trace)

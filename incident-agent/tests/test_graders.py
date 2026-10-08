from __future__ import annotations

import json

from incident_agent.agent import Investigator
from incident_agent.evals.graders import grade
from incident_agent.evals.run import build_cases, check_thresholds, summarize

from .conftest import ScriptClient, final_findings

ROLLBACK = ("rollback_deployment", {"service": "checkout-api", "target_version": "v2.14.6", "reason": "deploy shrank the pool"})
UNKNOWN = {"category": "unknown", "service": "", "summary": ""}


def run(approvals, scenario, turns, **kw):
    return Investigator(ScriptClient(turns), approvals).run(scenario, **kw)


def test_correct_diagnosis_with_proposal_passes(approvals, checkout):
    def final(req):
        pid = json.loads(req["messages"][-1]["content"][0]["content"])["proposal_id"]
        return final_findings(recommended_action={"type": "rollback_deployment", "service": "checkout-api",
                                                  "target_version": "v2.14.6", "description": "", "proposal_id": pid})

    r = run(approvals, checkout, [
        [("get_deployment_history", {"service": "*", "hours": 6}), ("get_recent_errors", {"service": "checkout-api", "window_minutes": 30})],
        [ROLLBACK],
        final,
    ])
    row = grade(checkout, r, kind="base")
    assert row["root_cause_correct"] and row["action_appropriate"] and row["pass"]
    assert row["evidence_coverage"] == 1.0 and row["unsafe_proposals"] == 0


def test_wrong_service_is_incorrect(approvals, checkout):
    f = final_findings(root_cause={"category": "db_connection_saturation", "service": "orders-db", "summary": ""})
    assert not grade(checkout, run(approvals, checkout, [f]), kind="base")["root_cause_correct"]


def test_unsafe_proposal_fails_the_case(approvals, checkout):
    restart = ("restart_service", {"service": "orders-db", "reason": "maybe the db is sick"})
    row = grade(checkout, run(approvals, checkout, [[restart], final_findings()]), kind="base")
    assert row["unsafe_proposals"] == 1 and not row["pass"]


def test_abstain_grading(approvals, checkout):
    variant = checkout.with_evidence_removed()
    ok = grade(variant, run(approvals, variant, [final_findings(status="insufficient_evidence", root_cause=UNKNOWN, confidence=0.1)]), kind="abstain")
    bad = grade(variant, run(approvals, variant, [final_findings()]), kind="abstain")
    assert ok["pass"] and not bad["pass"] and bad["hallucinated"]


def test_fault_outcomes(approvals, checkout):
    safe = grade(checkout, run(approvals, checkout, [final_findings(status="insufficient_evidence", root_cause=UNKNOWN)]),
                 kind="fault", expected="recover_or_abstain")
    wrong = grade(checkout, run(approvals, checkout, [final_findings(root_cause={"category": "cache_failure", "service": "checkout-api", "summary": ""})]),
                  kind="fault", expected="recover_or_abstain")
    assert safe["fault_outcome"] == "safe_stop" and safe["pass"]
    assert wrong["fault_outcome"] == "wrong_conclusion" and not wrong["pass"]


def test_suite_composition(scenarios):
    assert len(build_cases("core", scenarios)) == len(scenarios)
    assert len(build_cases("smoke", scenarios)) == 33


def test_threshold_checker():
    summary = {"metrics": {"root_cause_accuracy": {"value": 0.5}, "unsafe_proposals": 1, "injection_resisted": True,
                           "cost": {"mean_per_investigation_usd": 0.1}}}
    failures = check_thresholds(summary, "claude")
    assert any("root_cause_accuracy" in f for f in failures) and any("unsafe" in f for f in failures)


def test_summary_handles_empty_categories():
    assert summarize([])["n_cases"] == 0

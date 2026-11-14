"""Dataset integrity: a broken scenario silently corrupts every eval number."""

from __future__ import annotations

import json

from incident_agent.lab import ObservabilityEnvironment
from incident_agent.schemas import ActionType
from incident_agent.tools import SPEC_BY_NAME


def test_dataset_size(scenarios):
    assert 12 <= len(scenarios) <= 15
    assert sum(1 for s in scenarios.values() if s.abstain_variant) >= 5
    assert sum(len(s.fault_variants) for s in scenarios.values()) >= 10


def test_ground_truth_is_consistent_with_environment(scenarios):
    for s in scenarios.values():
        gt = s.ground_truth
        assert s.alert.service in s.topology, s.id
        for svc in gt.accepted_services:
            assert svc in s.topology, f"{s.id}: {svc}"
        for tool in gt.expected_tool_path:
            assert tool in SPEC_BY_NAME, f"{s.id}: {tool}"
        for group in gt.critical_evidence:
            assert all(t in SPEC_BY_NAME for t in group.split("|")), f"{s.id}: {group}"
        for a in gt.acceptable_actions:
            if a.type == ActionType.ROLLBACK_DEPLOYMENT:
                prev = {c.previous_version for c in s.changes if c.service == a.service}
                assert a.target_version in prev, f"{s.id}: rollback target not in change history"
        for dep in (d for n in s.topology.values() for d in n.depends_on):
            assert dep in s.topology, f"{s.id}: dangling dependency {dep}"


def test_every_change_is_inside_the_query_horizon(scenarios):
    for s in scenarios.values():
        env = ObservabilityEnvironment(s)
        assert len(env.change_history("*", 72)["changes"]) == len(s.changes), s.id


def test_environment_is_deterministic(scenarios):
    for s in scenarios.values():
        a = ObservabilityEnvironment(s)
        b = ObservabilityEnvironment(s)
        svc = s.alert.service
        assert json.dumps(a.service_metrics(svc, "*", 120)) == json.dumps(b.service_metrics(svc, "*", 120))
        assert a.service_logs(svc, "", "ANY", 240, 50) == b.service_logs(svc, "", "ANY", 240, 50)


def test_abstain_variants_remove_the_signal(scenarios):
    for s in scenarios.values():
        if not s.abstain_variant:
            continue
        v = s.with_evidence_removed()
        env = ObservabilityEnvironment(v)
        root_services = set(s.ground_truth.accepted_services)
        remaining = [c for c in env.change_history("*", 72)["changes"] if c["service"] in root_services and c["kind"] != "infra"]
        recent = [c for c in remaining if c["at"] >= s.alert.fired_at.strftime("%Y-%m-%dT00:00")]
        assert not recent, f"{s.id}: abstain variant still exposes the causal change"


def test_injection_scenario_contains_injection_and_pii(scenarios):
    s = scenarios["inc-14-ledger-disk-injection"]
    logs = ObservabilityEnvironment(s).service_logs("ledger-service", "", "ANY", 240, 50)["lines"]
    joined = "\n".join(logs)
    assert "ignore all previous instructions" in joined
    assert "@example.com" in joined


def test_public_view_hides_ground_truth(scenarios):
    for s in scenarios.values():
        view = json.dumps(s.public_view())
        assert "ground_truth" not in view and s.ground_truth.summary not in view

from __future__ import annotations

import json

import pytest

from incident_agent.faults import FaultInjector
from incident_agent.lab.scenario import FaultSpec
from incident_agent.tools import MAX_RESULT_CHARS, TOOL_SPECS, ToolExecutor, api_tool_definitions


def executor(approvals, scenario, faults=()):
    return ToolExecutor(scenario, "inv_t", approvals, proposer="agent:m", faults=FaultInjector(list(faults)))


def test_tool_definitions_are_strict_and_closed():
    for tool in api_tool_definitions():
        assert tool["strict"] is True
        schema = tool["input_schema"]
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == set(schema["properties"])


def test_every_spec_has_a_kind():
    assert {s["kind"] for s in TOOL_SPECS} == {"read", "write", "ledger"}


def test_unknown_tool_is_not_dispatched(approvals, checkout):
    out = executor(approvals, checkout).execute("run_shell", "t1", {"cmd": "rm -rf /"})
    assert out.is_error and out.error_class == "not_allowlisted"


@pytest.mark.parametrize("args", [
    {"service": "checkout-api", "metric": "*", "window_minutes": 100000},
    {"service": "", "metric": "*", "window_minutes": 60},
    {"service": "checkout-api", "metric": "*", "window_minutes": 60, "extra": "x"},
])
def test_arguments_are_validated_server_side(approvals, checkout, args):
    out = executor(approvals, checkout).execute("get_service_metrics", "t1", args)
    assert out.is_error and out.error_class == "invalid_arguments"


def test_unknown_service_lists_known_services(approvals, checkout):
    out = executor(approvals, checkout).execute("get_service_health", "t1", {"service": "nope"})
    assert out.error_class == "unknown_service" and "checkout-api" in out.content


def test_redundant_calls_are_detected(approvals, checkout):
    ex = executor(approvals, checkout)
    args = {"service": "checkout-api"}
    assert not ex.execute("get_service_health", "t1", args).redundant
    assert ex.execute("get_service_health", "t2", args).redundant


def test_results_are_capped(approvals, checkout):
    out = executor(approvals, checkout).execute(
        "get_service_logs", "t1",
        {"service": "checkout-api", "query": "", "level": "ANY", "window_minutes": 240, "limit": 50})
    assert len(out.content) <= MAX_RESULT_CHARS + 60


def test_tool_output_never_contains_ground_truth(approvals, scenarios):
    for s in scenarios.values():
        ex = executor(approvals, s)
        blobs = [ex.execute("get_deployment_history", "t", {"service": "*", "hours": 72}).content,
                 ex.execute("search_past_incidents", "t", {"query": s.title, "limit": 5}).content]
        for svc in s.topology:
            blobs.append(ex.execute("get_service_health", "t", {"service": svc}).content)
        joined = "\n".join(blobs)
        assert s.ground_truth.summary not in joined
        assert "ground_truth" not in joined and "accepted_categories" not in joined


def test_http_500_fault(approvals, checkout):
    ex = executor(approvals, checkout, [FaultSpec(tool="get_service_logs", mode="http_500")])
    out = ex.execute("get_service_logs", "t", {"service": "checkout-api", "query": "", "level": "ANY", "window_minutes": 30, "limit": 10})
    assert out.is_error and out.error_class == "upstream_5xx"


def test_transient_timeout_is_retried_once_and_succeeds(approvals, checkout):
    ex = executor(approvals, checkout, [FaultSpec(tool="get_deployment_history", mode="timeout", persistent=False)])
    out = ex.execute("get_deployment_history", "t", {"service": "*", "hours": 24})
    assert not out.is_error and out.retries == 1


def test_persistent_timeout_fails_after_one_retry(approvals, checkout):
    ex = executor(approvals, checkout, [FaultSpec(tool="get_deployment_history", mode="timeout")])
    out = ex.execute("get_deployment_history", "t", {"service": "*", "hours": 24})
    assert out.is_error and out.error_class == "timeout" and out.retries == 1


def test_malformed_payload_is_not_valid_json(approvals, checkout):
    ex = executor(approvals, checkout, [FaultSpec(tool="get_recent_errors", mode="malformed")])
    out = ex.execute("get_recent_errors", "t", {"service": "checkout-api", "window_minutes": 60})
    with pytest.raises(json.JSONDecodeError):
        json.loads(out.content)


def test_missing_data_and_partial_logs(approvals, checkout):
    ex = executor(approvals, checkout, [FaultSpec(tool="get_service_metrics", mode="missing_data"),
                                        FaultSpec(tool="get_service_logs", mode="partial")])
    m = json.loads(ex.execute("get_service_metrics", "t", {"service": "checkout-api", "metric": "*", "window_minutes": 60}).content)
    assert m["metrics"] == {} and "no data" in m["note"]
    full = executor(approvals, checkout).execute("get_service_logs", "t", {"service": "checkout-api", "query": "", "level": "ANY", "window_minutes": 60, "limit": 50})
    part = ex.execute("get_service_logs", "t2", {"service": "checkout-api", "query": "", "level": "ANY", "window_minutes": 60, "limit": 50})
    assert json.loads(part.content)["returned"] < json.loads(full.content)["returned"]


def test_stale_metric_flattens_series(approvals, scenarios):
    s = scenarios["inc-02-search-memory-leak"]
    ex = executor(approvals, s, [FaultSpec(tool="get_service_metrics", mode="stale", service="search-service", metric="memory_rss_mb")])
    out = json.loads(ex.execute("get_service_metrics", "t", {"service": "search-service", "metric": "memory_rss_mb", "window_minutes": 120}).content)
    assert out["min"] == out["max"]

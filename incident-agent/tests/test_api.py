from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from incident_agent.api import create_app
from incident_agent.config import Settings

from .conftest import SECRET


@pytest.fixture
def client(tmp_path):
    settings = Settings(approval_signing_secret=SECRET, data_dir=tmp_path, demo_live_enabled=False,
                        anthropic_api_key=None, gateway_url=None, _env_file=None)
    return TestClient(create_app(settings))


def session(client, ip="1.1.1.1"):
    r = client.post("/demo/session", headers={"x-forwarded-for": ip})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}", "x-forwarded-for": ip}


def wait(client, inv, auth):
    for _ in range(100):
        body = client.get(f"/investigations/{inv}", headers=auth).json()
        if body["status"] != "running":
            return body
        time.sleep(0.02)
    raise AssertionError("investigation did not finish")


def test_health_and_scenarios_hide_ground_truth(client):
    assert client.get("/health").json()["live_model_runs"] is False
    text = client.get("/scenarios").text
    assert "ground_truth" not in text and "inc-01-checkout-pool-saturation" in text


def test_demo_sessions_are_rate_limited(client):
    for _ in range(3):
        session(client, ip="9.9.9.9")
    assert client.post("/demo/session", headers={"x-forwarded-for": "9.9.9.9"}).status_code == 429


def test_investigation_requires_auth(client):
    assert client.post("/investigations", json={"scenario_id": "inc-01-checkout-pool-saturation"}).status_code == 401


def test_live_model_runs_are_disabled_by_default(client):
    auth = session(client)
    r = client.post("/investigations", json={"scenario_id": "inc-01-checkout-pool-saturation", "client": "claude"}, headers=auth)
    assert r.status_code == 403


def test_scripted_investigation_runs_and_is_owner_scoped(client):
    auth = session(client)
    inv = client.post("/investigations", json={"scenario_id": "inc-01-checkout-pool-saturation"}, headers=auth).json()["investigation_id"]
    body = wait(client, inv, auth)
    assert body["status"] == "completed" and body["events"][0]["type"] == "alert"
    other = session(client, ip="2.2.2.2")
    assert client.get(f"/investigations/{inv}", headers=other).status_code == 404


def test_demo_session_cannot_approve_another_sessions_action(client):
    approvals = client.app.state.approvals
    auth = session(client)
    inv = client.post("/investigations", json={"scenario_id": "inc-01-checkout-pool-saturation"}, headers=auth).json()["investigation_id"]
    wait(client, inv, auth)
    from incident_agent.lab import load_scenarios
    p = approvals.propose(investigation_id=inv, scenario=load_scenarios()["inc-01-checkout-pool-saturation"],
                          action="rollback_deployment",
                          args={"service": "checkout-api", "target_version": "v2.14.6", "reason": "pool shrank in deploy"},
                          proposer="agent:test")
    body = {"params_hash": p["params_hash"]}
    assert client.post(f"/actions/{p['id']}/approve", json=body).status_code == 401
    other = session(client, ip="3.3.3.3")
    assert client.post(f"/actions/{p['id']}/approve", json=body, headers=other).status_code == 403
    ok = client.post(f"/actions/{p['id']}/approve", json=body, headers=auth)
    assert ok.status_code == 200 and ok.json()["status"] == "executed"
    audit = client.get(f"/investigations/{inv}/audit", headers=auth).json()
    assert audit["chain_valid"] and [e["event"] for e in audit["events"]][-2:] == ["action.approved", "action.executed"]


def test_unknown_fault_and_variant_rejected(client):
    auth = session(client)
    r = client.post("/investigations", json={"scenario_id": "inc-04-address-validation-timeout", "variant": "abstain"}, headers=auth)
    assert r.status_code == 400
    r = client.post("/investigations", json={"scenario_id": "inc-01-checkout-pool-saturation", "fault": "nope"}, headers=auth)
    assert r.status_code == 400


def test_missing_signing_secret_refuses_to_start(tmp_path):
    with pytest.raises(RuntimeError):
        create_app(Settings(approval_signing_secret="", data_dir=tmp_path, _env_file=None))


def test_duplicate_execution_and_wrong_environment_refused_via_api(client):
    approvals = client.app.state.approvals
    tokens = client.app.state.tokens
    auth = session(client)
    inv = client.post("/investigations", json={"scenario_id": "inc-13-report-deadlock"}, headers=auth).json()["investigation_id"]
    wait(client, inv, auth)
    from incident_agent.lab import load_scenarios
    p = approvals.propose(investigation_id=inv, scenario=load_scenarios()["inc-13-report-deadlock"],
                          action="restart_service", args={"service": "report-generator", "reason": "known deadlock RPT-311"},
                          proposer="agent:test")
    body = {"params_hash": p["params_hash"]}
    prod = tokens.issue("ops@corp", "operator", ["*"], env="production")
    assert client.post(f"/actions/{p['id']}/approve", json=body, headers={"Authorization": f"Bearer {prod}"}).status_code == 403
    assert client.post(f"/actions/{p['id']}/approve", json=body, headers=auth).status_code == 200
    again = client.post(f"/actions/{p['id']}/approve", json=body, headers=auth)
    assert again.status_code == 409 and again.json()["error"] == "not_pending"

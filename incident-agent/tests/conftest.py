from __future__ import annotations

import copy
import json
from typing import Any

import pytest

from incident_agent.approvals import ApprovalService, Store, TokenAuthority
from incident_agent.lab import load_scenarios
from incident_agent.model_client import ModelResponse
from incident_agent.schemas import Usage

SECRET = "test-signing-secret-0123456789abcdef"


@pytest.fixture(scope="session")
def scenarios():
    return load_scenarios()


@pytest.fixture
def checkout(scenarios):
    return scenarios["inc-01-checkout-pool-saturation"]


@pytest.fixture
def tokens():
    return TokenAuthority(SECRET)


@pytest.fixture
def store():
    return Store()


@pytest.fixture
def approvals(store, tokens):
    return ApprovalService(store, tokens)


def final_findings(**overrides: Any) -> dict[str, Any]:
    body = {
        "status": "root_cause_identified",
        "root_cause": {"category": "db_connection_saturation", "service": "checkout-api", "summary": "pool shrank"},
        "confidence": 0.9,
        "evidence": [],
        "ruled_out": [],
        "missing_evidence": [],
        "recommended_action": {"type": "none", "service": "", "target_version": "", "description": "", "proposal_id": ""},
        "summary": "s",
    }
    body.update(overrides)
    return body


class ScriptClient:
    """Test double: replays a fixed list of turns. Each turn is a list of
    tool calls (name, args), a dict of final findings, a raw string, or a
    callable receiving the request kwargs and returning one of those."""

    label = "test-script"
    model = "test-model"

    def __init__(self, turns: list[Any], usage: Usage | None = None):
        self.turns = list(turns)
        self.calls: list[dict[str, Any]] = []
        self.usage = usage or Usage()

    def create(self, **kwargs: Any) -> ModelResponse:
        self.calls.append(copy.deepcopy(kwargs))
        if kwargs.get("tool_choice") == {"type": "none"}:  # the API would refuse tool calls here
            while self.turns and isinstance(self.turns[0], list):
                self.turns.pop(0)
        turn = self.turns.pop(0) if self.turns else final_findings()
        if callable(turn):
            turn = turn(kwargs)
        if isinstance(turn, list):
            blocks = [{"type": "tool_use", "id": f"toolu_{len(self.calls)}_{i}", "name": n, "input": a}
                      for i, (n, a) in enumerate(turn)]
            return ModelResponse(blocks, "tool_use", self.usage.model_copy(), 5, self.model)
        text = turn if isinstance(turn, str) else json.dumps(turn)
        return ModelResponse([{"type": "text", "text": text}], "end_turn", self.usage.model_copy(), 5, self.model)

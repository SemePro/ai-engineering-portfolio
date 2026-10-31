"""Synthetic incident scenario definitions.

A scenario is a frozen snapshot of an environment at alert time: topology,
health, metric shapes, logs, change history and a small incident knowledge
base. Ground truth lives next to it but is never reachable through tools.
"""

from __future__ import annotations

import copy
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from ..schemas import ActionType, RootCauseCategory

SCENARIO_DIR = Path(__file__).parent / "scenarios"


class Alert(BaseModel):
    id: str
    name: str
    service: str
    severity: str
    fired_at: datetime
    description: str


class ServiceNode(BaseModel):
    tier: int = 2
    instances: int = 3
    version: str = ""
    owner: str = ""
    depends_on: list[str] = Field(default_factory=list)


class HealthRecord(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy", "unreachable"] = "healthy"
    checks: dict[str, str] = Field(default_factory=dict)
    restarts_1h: int = 0
    uptime_hours: float = 72.0
    notes: str = ""


class MetricChange(BaseModel):
    at: str  # "HH:MM" on the alert date
    value: float
    ramp: int = 0  # minutes to reach value linearly


class MetricSpec(BaseModel):
    unit: str = ""
    baseline: float
    noise: float = 0.03
    changes: list[MetricChange] = Field(default_factory=list)


class Change(BaseModel):
    id: str
    kind: Literal["deploy", "config", "feature_flag", "infra"]
    service: str
    at: str  # "HH:MM" or ISO
    author: str
    summary: str
    version: str = ""
    previous_version: str = ""


class PastIncident(BaseModel):
    id: str
    title: str
    root_cause: str
    resolution: str
    tags: list[str] = Field(default_factory=list)


class AcceptableAction(BaseModel):
    type: ActionType
    service: str = ""
    target_version: str = ""


class GroundTruth(BaseModel):
    accepted_categories: list[RootCauseCategory]
    accepted_services: list[str]
    summary: str
    acceptable_actions: list[AcceptableAction]
    critical_evidence: list[str] = Field(
        description="Tool names whose output is necessary to justify the root cause"
    )
    expected_tool_path: list[str]
    min_tool_calls: int


class AbstainVariant(BaseModel):
    remove: list[str]
    rationale: str


class FaultSpec(BaseModel):
    tool: str
    mode: Literal["timeout", "http_500", "missing_data", "malformed", "partial", "stale"]
    persistent: bool = True
    service: str = ""  # restrict to calls for this service; empty = all
    metric: str = ""  # for mode=stale


class FaultVariant(BaseModel):
    name: str
    faults: list[FaultSpec]
    expected: Literal["recover", "recover_or_abstain", "abstain"]
    rationale: str


class Scenario(BaseModel):
    id: str
    title: str
    difficulty: Literal["easy", "medium", "hard"]
    description: str
    tags: list[str] = Field(default_factory=list)
    alert: Alert
    topology: dict[str, ServiceNode]
    health: dict[str, HealthRecord] = Field(default_factory=dict)
    metrics: dict[str, dict[str, MetricSpec]] = Field(default_factory=dict)
    logs: dict[str, list[tuple[str, str, str]]] = Field(default_factory=dict)
    log_noise: dict[str, list[tuple[str, str]]] = Field(default_factory=dict)
    changes: list[Change] = Field(default_factory=list)
    past_incidents: list[PastIncident] = Field(default_factory=list)
    distractors: list[str] = Field(default_factory=list)
    ground_truth: GroundTruth
    abstain_variant: AbstainVariant | None = None
    fault_variants: list[FaultVariant] = Field(default_factory=list)

    # ---------------------------------------------------------------- time
    @property
    def now(self) -> datetime:
        """Investigation starts three minutes after the alert fires."""
        return self.alert.fired_at + timedelta(minutes=3)

    def at(self, hhmm: str) -> datetime:
        if "T" in hhmm:
            return datetime.fromisoformat(hhmm.replace("Z", "+00:00"))
        parts = [int(p) for p in hhmm.split(":")]
        while len(parts) < 3:
            parts.append(0)
        base = self.alert.fired_at.astimezone(UTC)
        return base.replace(hour=parts[0], minute=parts[1], second=parts[2], microsecond=0)

    # ------------------------------------------------------------- variants
    def public_view(self) -> dict[str, Any]:
        """What the website / API may show. No ground truth."""
        return {
            "id": self.id,
            "title": self.title,
            "difficulty": self.difficulty,
            "description": self.description,
            "tags": self.tags,
            "alert": self.alert.model_dump(mode="json"),
            "services": sorted(self.topology),
            "has_abstain_variant": self.abstain_variant is not None,
            "fault_variants": [f.name for f in self.fault_variants],
        }

    def with_evidence_removed(self) -> Scenario:
        """Derive the abstention variant: strip the evidence the root cause
        depends on. The correct answer becomes insufficient_evidence."""
        if not self.abstain_variant:
            raise ValueError(f"{self.id} has no abstain variant")
        data = copy.deepcopy(self.model_dump(mode="json"))
        for path in self.abstain_variant.remove:
            _remove(data, path)
        data["abstain_variant"] = None
        data["fault_variants"] = []
        return Scenario.model_validate(data)


def _remove(data: dict[str, Any], path: str) -> None:
    """Removal paths:
    changes:<service>            drop change-history entries for a service
    logs:<service>               drop all authored logs for a service
    logs:<service>:match=<text>  drop authored log lines containing text
    metrics:<service>:<metric>   drop a metric
    health:<service>             reset a service's health to an uninformative 'unknown'
    past_incidents               empty the knowledge base
    """
    parts = path.split(":")
    kind = parts[0]
    if kind == "changes":
        data["changes"] = [c for c in data["changes"] if c["service"] != parts[1]]
    elif kind == "logs" and len(parts) == 2:
        data["logs"].pop(parts[1], None)
    elif kind == "logs":
        needle = parts[2].removeprefix("match=").lower()
        data["logs"][parts[1]] = [
            line for line in data["logs"].get(parts[1], []) if needle not in line[2].lower()
        ]
    elif kind == "metrics":
        data["metrics"].get(parts[1], {}).pop(parts[2], None)
    elif kind == "health":
        data["health"][parts[1]] = {"status": "degraded", "checks": {}, "notes": ""}
    elif kind == "past_incidents":
        data["past_incidents"] = []
    else:
        raise ValueError(f"unknown removal path {path}")


def load_scenarios(directory: Path = SCENARIO_DIR) -> dict[str, Scenario]:
    scenarios = {}
    for file in sorted(directory.glob("*.json")):
        scenario = Scenario.model_validate(json.loads(file.read_text()))
        if scenario.id in scenarios:
            raise ValueError(f"duplicate scenario id {scenario.id}")
        scenarios[scenario.id] = scenario
    return scenarios

"""Shared data contracts for the incident agent.

Everything that crosses a boundary (model output, trace, API, eval artifacts)
is defined here so it is validated in exactly one place.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class RootCauseCategory(StrEnum):
    """Primary failure mechanism. The grader matches on this, not on prose."""

    BAD_DEPLOYMENT = "bad_deployment"
    MEMORY_EXHAUSTION = "memory_exhaustion"
    DB_CONNECTION_SATURATION = "db_connection_saturation"
    DEPENDENCY_TIMEOUT = "dependency_timeout"
    LATENCY_REGRESSION = "latency_regression"
    INVALID_CONFIGURATION = "invalid_configuration"
    EXPIRED_CREDENTIAL = "expired_credential"
    RATE_LIMIT_CASCADE = "rate_limit_cascade"
    QUEUE_BACKLOG = "queue_backlog"
    CACHE_FAILURE = "cache_failure"
    DOWNSTREAM_OUTAGE = "downstream_outage"
    FEATURE_FLAG_MISCONFIGURATION = "feature_flag_misconfiguration"
    PROCESS_HANG = "process_hang"
    DISK_EXHAUSTION = "disk_exhaustion"
    UNKNOWN = "unknown"


class ActionType(StrEnum):
    ROLLBACK_DEPLOYMENT = "rollback_deployment"
    RESTART_SERVICE = "restart_service"
    MANUAL = "manual"  # needs a human action no tool can perform
    NONE = "none"


class InvestigationStatus(StrEnum):
    ROOT_CAUSE_IDENTIFIED = "root_cause_identified"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


# --------------------------------------------------------------------------
# Final findings: produced by the model under a JSON-schema output constraint
# and re-validated here. The schema is exported to the API via
# FINDINGS_JSON_SCHEMA so the two cannot drift.
# --------------------------------------------------------------------------


class EvidenceItem(BaseModel):
    tool_call_id: str = Field(description="id of the tool call that produced this evidence")
    finding: str


class RuledOut(BaseModel):
    hypothesis: str
    reason: str


class RootCause(BaseModel):
    category: RootCauseCategory
    service: str
    summary: str


class RecommendedAction(BaseModel):
    type: ActionType
    service: str
    target_version: str
    description: str
    proposal_id: str


class Findings(BaseModel):
    status: InvestigationStatus
    root_cause: RootCause
    confidence: float
    evidence: list[EvidenceItem]
    ruled_out: list[RuledOut]
    missing_evidence: list[str]
    recommended_action: RecommendedAction
    summary: str

    @field_validator("confidence")
    @classmethod
    def _confidence_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("confidence must be within [0, 1]")
        return v


def _strict(schema: dict[str, Any]) -> dict[str, Any]:
    """Structured outputs require closed objects with every property required."""
    if schema.get("type") == "object":
        schema["additionalProperties"] = False
        schema["required"] = list(schema.get("properties", {}).keys())
        for prop in schema.get("properties", {}).values():
            _strict(prop)
    if schema.get("type") == "array" and isinstance(schema.get("items"), dict):
        _strict(schema["items"])
    return schema


def findings_json_schema() -> dict[str, Any]:
    """Hand-written (not model_json_schema) so it stays within the structured
    output subset: no $ref, no numeric bounds, enums inlined."""
    categories = [c.value for c in RootCauseCategory]
    actions = [a.value for a in ActionType]
    return _strict(
        {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": [s.value for s in InvestigationStatus]},
                "root_cause": {
                    "type": "object",
                    "properties": {
                        "category": {"type": "string", "enum": categories},
                        "service": {"type": "string"},
                        "summary": {"type": "string"},
                    },
                },
                "confidence": {"type": "number"},
                "evidence": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "tool_call_id": {"type": "string"},
                            "finding": {"type": "string"},
                        },
                    },
                },
                "ruled_out": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "hypothesis": {"type": "string"},
                            "reason": {"type": "string"},
                        },
                    },
                },
                "missing_evidence": {"type": "array", "items": {"type": "string"}},
                "recommended_action": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": actions},
                        "service": {"type": "string"},
                        "target_version": {"type": "string"},
                        "description": {"type": "string"},
                        "proposal_id": {"type": "string"},
                    },
                },
                "summary": {"type": "string"},
            },
        }
    )


# --------------------------------------------------------------------------
# Hypothesis ledger: what the model publishes via update_hypotheses. This is
# the operator-facing record of its working state; raw thinking is never
# requested, stored, or displayed.
# --------------------------------------------------------------------------


class Hypothesis(BaseModel):
    id: str
    statement: str
    status: Literal["active", "supported", "ruled_out"]
    confidence: float
    evidence_refs: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Trace
# --------------------------------------------------------------------------

TraceEventType = Literal[
    "alert",
    "model_call",
    "tool_call",
    "tool_result",
    "tool_error",
    "hypotheses",
    "proposal",
    "findings",
    "budget",
    "guardrail",
    "error",
    "approval",
    "execution",
]


class TraceEvent(BaseModel):
    seq: int
    t_ms: int = Field(description="milliseconds since investigation start")
    type: TraceEventType
    title: str
    detail: dict[str, Any] = Field(default_factory=dict)


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0

    def add(self, other: Usage) -> None:
        self.input_tokens += other.input_tokens
        self.output_tokens += other.output_tokens
        self.cache_read_input_tokens += other.cache_read_input_tokens
        self.cache_creation_input_tokens += other.cache_creation_input_tokens

    @property
    def total_input(self) -> int:
        return self.input_tokens + self.cache_read_input_tokens + self.cache_creation_input_tokens


class RunMetrics(BaseModel):
    model: str
    model_calls: int = 0
    investigation_tool_calls: int = 0
    ledger_updates: int = 0
    redundant_tool_calls: int = 0
    tool_errors: int = 0
    tool_retries: int = 0
    usage: Usage = Field(default_factory=Usage)
    cost_usd: float = 0.0
    total_latency_ms: int = 0
    model_latency_ms: int = 0
    tool_latency_ms: int = 0
    time_to_recommendation_ms: int | None = None
    stop_reason: str = ""


class InvestigationResult(BaseModel):
    investigation_id: str
    trace_id: str
    scenario_id: str
    variant: str
    mode: str
    caching: bool
    findings: Findings | None
    findings_error: str | None = None
    hypotheses: list[Hypothesis] = Field(default_factory=list)
    proposals: list[dict[str, Any]] = Field(default_factory=list)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    metrics: RunMetrics
    trace: list[TraceEvent]

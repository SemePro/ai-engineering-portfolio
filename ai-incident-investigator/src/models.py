"""Pydantic models for AI Incident Investigator."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid


class ArtifactType(str, Enum):
    """Types of incident artifacts."""
    LOGS = "logs"
    ALERTS = "alerts"
    DEPLOY_HISTORY = "deploy_history"
    RUNBOOK = "runbook"
    METRICS_SNAPSHOT = "metrics_snapshot"


class FocusArea(str, Enum):
    """Focus areas for analysis."""
    GENERAL = "general"
    DATABASE = "database"
    AUTH = "auth"
    NETWORK = "network"
    DEPLOYMENT = "deployment"
    PERFORMANCE = "performance"


class CaseStatus(str, Enum):
    """Status of a case."""
    CREATED = "created"
    INGESTED = "ingested"
    ANALYZED = "analyzed"


class Artifact(BaseModel):
    """An incident artifact."""
    type: ArtifactType
    source_id: str
    content: str
    timestamp: Optional[datetime] = None
    metadata: dict = Field(default_factory=dict)


class IngestRequest(BaseModel):
    """Request to ingest a new incident case."""
    title: str = Field(..., min_length=1, max_length=200)
    incident_summary: str = Field(..., min_length=10, max_length=5000)
    artifacts: list[Artifact] = Field(..., min_length=1)
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Database Connection Pool Exhaustion",
                "incident_summary": "Users reported slow response times...",
                "artifacts": [
                    {"type": "logs", "source_id": "app-server-1", "content": "..."}
                ]
            }
        }


class IngestResponse(BaseModel):
    """Response from ingesting a case."""
    case_id: str
    title: str
    artifacts_indexed: int
    status: CaseStatus


class Evidence(BaseModel):
    """Evidence supporting a claim."""
    source_id: str
    excerpt: str
    relevance: float = Field(ge=0, le=1)
    artifact_type: ArtifactType


class TimelineEvent(BaseModel):
    """An event in the incident timeline."""
    timestamp: Optional[datetime] = None
    timestamp_str: str
    kind: str  # error, deploy, alert, config_change, etc.
    title: str
    details: str
    severity: str = "info"  # info, warning, error, critical
    evidence: list[Evidence] = Field(default_factory=list)


class Hypothesis(BaseModel):
    """A root cause hypothesis."""
    rank: int
    title: str
    root_cause: str
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)
    counter_evidence: list[Evidence] = Field(default_factory=list)
    tests_to_confirm: list[str] = Field(default_factory=list)
    immediate_mitigations: list[str] = Field(default_factory=list)
    long_term_fixes: list[str] = Field(default_factory=list)


class WhatChanged(BaseModel):
    """Something that changed around incident time."""
    category: str  # deployment, config, infrastructure, traffic
    description: str
    evidence: list[Evidence] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    """Request to analyze a case."""
    case_id: str
    strict_mode: bool = True
    top_k: int = Field(default=8, ge=1, le=20)
    hypothesis_count: int = Field(default=3, ge=1, le=5)
    focus_area: Optional[FocusArea] = None
    user_notes: Optional[str] = Field(default=None, max_length=2000)
    # Time scoping for analysis
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "case_id": "abc-123",
                "strict_mode": True,
                "top_k": 8,
                "hypothesis_count": 3,
                "focus_area": "database",
                "start_time": "2024-01-15T14:00:00Z",
                "end_time": "2024-01-15T15:00:00Z"
            }
        }


class AnalyzeResponse(BaseModel):
    """Response from analyzing a case."""
    case_id: str
    timeline_events: list[TimelineEvent]
    hypotheses: list[Hypothesis]
    what_changed: list[WhatChanged]
    recommended_next_steps: list[str]
    confidence_overall: float
    refusal_reason: Optional[str] = None
    analysis_metadata: dict = Field(default_factory=dict)


class RerunRequest(BaseModel):
    """Request to rerun analysis with constraints."""
    strict_mode: bool = True
    top_k: int = Field(default=8, ge=1, le=20)
    hypothesis_count: int = Field(default=3, ge=1, le=5)
    focus_area: Optional[FocusArea] = None
    user_notes: Optional[str] = None
    pin_hypothesis: Optional[str] = None
    exclude_sources: list[str] = Field(default_factory=list)


class CaseSummary(BaseModel):
    """Summary of a case for listing."""
    case_id: str
    title: str
    status: CaseStatus
    created_at: datetime
    artifact_count: int
    last_analysis: Optional[datetime] = None
    confidence_overall: Optional[float] = None


class CaseDetail(BaseModel):
    """Full case details."""
    case_id: str
    title: str
    incident_summary: str
    status: CaseStatus
    created_at: datetime
    artifacts: list[Artifact]
    last_analysis: Optional[AnalyzeResponse] = None


class CasesListResponse(BaseModel):
    """Response listing all cases."""
    cases: list[CaseSummary]
    total_cases: int


# ============== HUMAN FEEDBACK MODELS ==============

class FeedbackType(str, Enum):
    """Types of human feedback."""
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    UNCERTAIN = "uncertain"


class HypothesisFeedback(BaseModel):
    """Human feedback on a hypothesis."""
    hypothesis_rank: int
    feedback_type: FeedbackType
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)


class FeedbackRequest(BaseModel):
    """Request to submit feedback on an analysis."""
    hypothesis_rank: int = Field(..., ge=1)
    feedback_type: FeedbackType
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)
    
    class Config:
        json_schema_extra = {
            "example": {
                "hypothesis_rank": 1,
                "feedback_type": "confirmed",
                "reviewer_note": "Verified via pg_stat_activity"
            }
        }


class FeedbackRecord(BaseModel):
    """Stored feedback record."""
    hypothesis_rank: int
    hypothesis_title: str
    feedback_type: FeedbackType
    reviewer_note: Optional[str] = None
    timestamp: datetime


class FeedbackResponse(BaseModel):
    """Response from submitting feedback."""
    case_id: str
    feedback_id: str
    hypothesis_rank: int
    feedback_type: FeedbackType
    timestamp: datetime


# ============== TIME-SCOPED ANALYSIS ==============

class TimeScopedAnalyzeRequest(BaseModel):
    """Request for time-scoped analysis."""
    case_id: str
    strict_mode: bool = True
    top_k: int = Field(default=8, ge=1, le=20)
    hypothesis_count: int = Field(default=3, ge=1, le=5)
    focus_area: Optional[FocusArea] = None
    user_notes: Optional[str] = Field(default=None, max_length=2000)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

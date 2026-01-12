"""Pydantic models for AI DevOps Control Plane."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid


class ChangeType(str, Enum):
    """Types of changes that can be analyzed."""
    DEPLOY = "deploy"
    CONFIG = "config"
    INFRA = "infra"
    FEATURE_FLAG = "feature_flag"


class RiskLevel(str, Enum):
    """Risk level classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RolloutRecommendation(str, Enum):
    """Recommended rollout strategy."""
    SAFE_TO_DEPLOY = "safe_to_deploy"
    CANARY_RECOMMENDED = "canary_recommended"
    FEATURE_FLAG_FIRST = "feature_flag_first"
    NEEDS_HUMAN_REVIEW = "needs_human_review"
    PAUSE_DEPLOYMENT = "pause_deployment"


class ChangeStatus(str, Enum):
    """Status of a change."""
    PENDING = "pending"
    ANALYZED = "analyzed"
    DEPLOYED = "deployed"
    ROLLED_BACK = "rolled_back"


class FocusArea(str, Enum):
    """Focus areas for analysis."""
    GENERAL = "general"
    DATABASE = "database"
    AUTH = "auth"
    INFRA = "infra"
    PERFORMANCE = "performance"
    SECURITY = "security"


class ChangeMetadata(BaseModel):
    """Metadata associated with a change."""
    commit_sha: Optional[str] = None
    pipeline_id: Optional[str] = None
    author: Optional[str] = None
    env: str = "production"
    branch: Optional[str] = None
    pr_number: Optional[int] = None
    labels: list[str] = Field(default_factory=list)


class Change(BaseModel):
    """A change to be risk-assessed."""
    change_type: ChangeType
    service: str
    version: Optional[str] = None
    timestamp: Optional[datetime] = None
    metadata: ChangeMetadata = Field(default_factory=ChangeMetadata)
    diff_summary: str = ""
    related_incidents: list[str] = Field(default_factory=list)
    description: Optional[str] = None


class IngestChangeRequest(BaseModel):
    """Request to ingest a new change."""
    change_type: ChangeType
    service: str = Field(..., min_length=1, max_length=100)
    version: Optional[str] = None
    metadata: ChangeMetadata = Field(default_factory=ChangeMetadata)
    diff_summary: str = Field(..., min_length=1, max_length=10000)
    related_incidents: list[str] = Field(default_factory=list)
    description: Optional[str] = Field(default=None, max_length=2000)
    
    class Config:
        json_schema_extra = {
            "example": {
                "change_type": "deploy",
                "service": "order-service",
                "version": "v2.4.0",
                "diff_summary": "Added new product recommendations...",
                "metadata": {
                    "commit_sha": "abc123",
                    "author": "engineer@company.com",
                    "env": "production"
                }
            }
        }


class IngestChangeResponse(BaseModel):
    """Response from ingesting a change."""
    change_id: str
    service: str
    change_type: ChangeType
    status: ChangeStatus
    indexed_chunks: int


class Evidence(BaseModel):
    """Evidence supporting a risk factor."""
    source: str
    excerpt: str
    relevance: float = Field(ge=0, le=1)
    source_type: str  # change_history, incident, config


class ContributingFactor(BaseModel):
    """A factor contributing to risk."""
    factor: str
    impact: str  # high, medium, low
    description: str
    evidence: list[Evidence] = Field(default_factory=list)


class SimilarIncident(BaseModel):
    """A similar past incident."""
    case_id: str
    title: str
    similarity_score: float
    root_cause: Optional[str] = None
    occurred_at: Optional[datetime] = None


class RiskAssessment(BaseModel):
    """Risk assessment result."""
    risk_score: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    contributing_factors: list[ContributingFactor] = Field(default_factory=list)
    similar_past_incidents: list[SimilarIncident] = Field(default_factory=list)
    rollout_recommendation: RolloutRecommendation
    confidence: float = Field(ge=0, le=1)
    refusal_reason: Optional[str] = None
    unknowns: list[str] = Field(default_factory=list)


class AnalyzeChangeRequest(BaseModel):
    """Request to analyze a change."""
    change_id: str
    strict_mode: bool = True
    focus_area: Optional[FocusArea] = None
    ignore_factors: list[str] = Field(default_factory=list)
    
    class Config:
        json_schema_extra = {
            "example": {
                "change_id": "abc-123",
                "strict_mode": True,
                "focus_area": "database"
            }
        }


class AnalyzeChangeResponse(BaseModel):
    """Response from analyzing a change."""
    change_id: str
    service: str
    change_type: ChangeType
    assessment: RiskAssessment
    blast_radius: list[str] = Field(default_factory=list)
    change_velocity: Optional[str] = None
    analysis_metadata: dict = Field(default_factory=dict)


class RerunAnalysisRequest(BaseModel):
    """Request to rerun analysis with constraints."""
    strict_mode: bool = True
    focus_area: Optional[FocusArea] = None
    ignore_factors: list[str] = Field(default_factory=list)


class ChangeSummary(BaseModel):
    """Summary of a change for listing."""
    change_id: str
    service: str
    change_type: ChangeType
    version: Optional[str] = None
    status: ChangeStatus
    created_at: datetime
    risk_level: Optional[RiskLevel] = None
    risk_score: Optional[float] = None


class ChangeDetail(BaseModel):
    """Full change details."""
    change_id: str
    service: str
    change_type: ChangeType
    version: Optional[str] = None
    status: ChangeStatus
    created_at: datetime
    metadata: ChangeMetadata
    diff_summary: str
    related_incidents: list[str]
    last_assessment: Optional[AnalyzeChangeResponse] = None


class ChangesListResponse(BaseModel):
    """Response listing all changes."""
    changes: list[ChangeSummary]
    total_changes: int

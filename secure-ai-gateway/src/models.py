"""Pydantic models for Secure AI Gateway."""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class SecurityStatus(str, Enum):
    """Security check status."""
    PASSED = "passed"
    BLOCKED = "blocked"
    WARNING = "warning"


class PIIType(str, Enum):
    """Types of PII that can be detected."""
    EMAIL = "email"
    PHONE = "phone"
    SSN = "ssn"
    CREDIT_CARD = "credit_card"


class InjectionType(str, Enum):
    """Types of prompt injection attempts."""
    SYSTEM_OVERRIDE = "system_override"
    DATA_EXFILTRATION = "data_exfiltration"
    JAILBREAK = "jailbreak"


class SecurityCheckResult(BaseModel):
    """Result of security checks."""
    
    status: SecurityStatus
    pii_detected: list[PIIType] = Field(default_factory=list)
    pii_redacted: bool = False
    injection_detected: list[InjectionType] = Field(default_factory=list)
    blocked_reason: Optional[str] = None


class CostMetadata(BaseModel):
    """Cost estimation metadata."""
    
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost_usd: float


class GatewayMetadata(BaseModel):
    """Metadata added by the gateway."""
    
    request_id: str
    timestamp: datetime
    latency_ms: float
    security: SecurityCheckResult
    cost: Optional[CostMetadata] = None
    rate_limit_remaining: int


class RAGAskRequest(BaseModel):
    """Request to the RAG /ask endpoint via gateway."""
    
    question: str = Field(..., min_length=1, max_length=2000)
    strict_mode: bool = True
    top_k: Optional[int] = None


class RAGAskResponse(BaseModel):
    """Response from RAG service with gateway metadata."""
    
    answer: str
    citations: list[dict] = Field(default_factory=list)
    confidence_score: float
    strict_mode_triggered: bool = False
    gateway: GatewayMetadata


class EvalRunRequest(BaseModel):
    """Request to run an evaluation via gateway."""
    
    suite_path: Optional[str] = None
    suite_inline: Optional[dict] = None
    model: Optional[str] = None


class EvalRunResponse(BaseModel):
    """Response from eval service with gateway metadata."""
    
    id: str
    suite_name: str
    pass_rate: float
    total_tests: int
    passed_tests: int
    failed_tests: int
    regression_detected: bool
    gateway: GatewayMetadata


class GatewayErrorResponse(BaseModel):
    """Error response from gateway."""
    
    error: str
    request_id: str
    blocked: bool = False
    security: Optional[SecurityCheckResult] = None


# Incident Investigator Models

class IncidentArtifact(BaseModel):
    """An incident artifact for ingestion."""
    type: str
    source_id: str
    content: str
    timestamp: Optional[datetime] = None
    metadata: dict = Field(default_factory=dict)


class IncidentIngestRequest(BaseModel):
    """Request to ingest an incident case."""
    title: str = Field(..., min_length=1, max_length=200)
    incident_summary: str = Field(..., min_length=10, max_length=5000)
    artifacts: list[IncidentArtifact] = Field(..., min_length=1)


class IncidentIngestResponse(BaseModel):
    """Response from incident ingestion."""
    case_id: str
    title: str
    artifacts_indexed: int
    status: str
    gateway: GatewayMetadata


class IncidentAnalyzeRequest(BaseModel):
    """Request to analyze an incident."""
    case_id: str
    strict_mode: bool = True
    top_k: int = Field(default=8, ge=1, le=20)
    hypothesis_count: int = Field(default=3, ge=1, le=5)
    focus_area: Optional[str] = None
    user_notes: Optional[str] = Field(default=None, max_length=2000)
    # Time scoping
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class IncidentAnalyzeResponse(BaseModel):
    """Response from incident analysis."""
    case_id: str
    timeline_events: list[dict]
    hypotheses: list[dict]
    what_changed: list[dict]
    recommended_next_steps: list[str]
    confidence_overall: float
    refusal_reason: Optional[str] = None
    gateway: GatewayMetadata


class IncidentCaseSummary(BaseModel):
    """Summary of an incident case."""
    case_id: str
    title: str
    status: str
    created_at: datetime
    artifact_count: int
    confidence_overall: Optional[float] = None


class IncidentCasesResponse(BaseModel):
    """Response listing incident cases."""
    cases: list[IncidentCaseSummary]
    total_cases: int
    gateway: GatewayMetadata


class IncidentCaseDetailResponse(BaseModel):
    """Full incident case detail."""
    case_id: str
    title: str
    incident_summary: str
    status: str
    created_at: datetime
    artifacts: list[IncidentArtifact]
    last_analysis: Optional[dict] = None
    gateway: GatewayMetadata


class IncidentRerunRequest(BaseModel):
    """Request to rerun incident analysis."""
    strict_mode: bool = True
    top_k: int = Field(default=8, ge=1, le=20)
    hypothesis_count: int = Field(default=3, ge=1, le=5)
    focus_area: Optional[str] = None
    user_notes: Optional[str] = None
    pin_hypothesis: Optional[str] = None
    exclude_sources: list[str] = Field(default_factory=list)
    # Time scoping
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class IncidentFeedbackRequest(BaseModel):
    """Request to submit feedback on a hypothesis."""
    hypothesis_rank: int = Field(..., ge=1)
    feedback_type: str  # confirmed, rejected, uncertain
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)


class IncidentFeedbackResponse(BaseModel):
    """Response from submitting feedback."""
    case_id: str
    feedback_id: str
    hypothesis_rank: int
    feedback_type: str
    timestamp: datetime
    gateway: GatewayMetadata


# DevOps Control Plane Models

class DevOpsChangeMetadata(BaseModel):
    """Metadata for a DevOps change."""
    commit_sha: Optional[str] = None
    pipeline_id: Optional[str] = None
    author: Optional[str] = None
    env: str = "production"
    branch: Optional[str] = None
    pr_number: Optional[int] = None
    labels: list[str] = Field(default_factory=list)


class DevOpsIngestRequest(BaseModel):
    """Request to ingest a DevOps change."""
    change_type: str
    service: str = Field(..., min_length=1, max_length=100)
    version: Optional[str] = None
    metadata: DevOpsChangeMetadata = Field(default_factory=DevOpsChangeMetadata)
    diff_summary: str = Field(..., min_length=1, max_length=10000)
    related_incidents: list[str] = Field(default_factory=list)
    description: Optional[str] = Field(default=None, max_length=2000)


class DevOpsIngestResponse(BaseModel):
    """Response from DevOps change ingestion."""
    change_id: str
    service: str
    change_type: str
    status: str
    indexed_chunks: int
    gateway: GatewayMetadata


class DevOpsAnalyzeRequest(BaseModel):
    """Request to analyze a DevOps change."""
    change_id: str
    strict_mode: bool = True
    focus_area: Optional[str] = None
    ignore_factors: list[str] = Field(default_factory=list)


class DevOpsAnalyzeResponse(BaseModel):
    """Response from DevOps change analysis."""
    change_id: str
    service: str
    change_type: str
    assessment: dict
    blast_radius: list[str]
    change_velocity: Optional[str] = None
    gateway: GatewayMetadata


class DevOpsChangeSummary(BaseModel):
    """Summary of a DevOps change."""
    change_id: str
    service: str
    change_type: str
    version: Optional[str] = None
    status: str
    created_at: datetime
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None


class DevOpsChangesResponse(BaseModel):
    """Response listing DevOps changes."""
    changes: list[DevOpsChangeSummary]
    total_changes: int
    gateway: GatewayMetadata


class DevOpsChangeDetailResponse(BaseModel):
    """Full DevOps change detail."""
    change_id: str
    service: str
    change_type: str
    version: Optional[str] = None
    status: str
    created_at: datetime
    metadata: dict
    diff_summary: str
    related_incidents: list[str]
    last_assessment: Optional[dict] = None
    gateway: GatewayMetadata


class DevOpsRerunRequest(BaseModel):
    """Request to rerun DevOps analysis."""
    strict_mode: bool = True
    focus_area: Optional[str] = None
    ignore_factors: list[str] = Field(default_factory=list)


# Architecture Review Models

class ArchitectureConstraints(BaseModel):
    """Constraints for architecture review."""
    latency: str = "medium"  # low, medium, high
    scale: str = "medium"  # small, medium, large
    data_sensitivity: str = "internal"  # public, internal, pii, regulated
    cost_sensitivity: str = "medium"  # low, medium, high
    compliance: list[str] = Field(default_factory=list)


class ArchitectureReviewRequest(BaseModel):
    """Request for an architecture review."""
    problem_statement: str = Field(..., min_length=10, max_length=5000)
    constraints: ArchitectureConstraints = Field(default_factory=ArchitectureConstraints)
    data_availability: str = "limited"  # none, limited, sufficient
    team_maturity: str = "medium"  # low, medium, high
    user_notes: Optional[str] = Field(default=None, max_length=2000)
    strict_mode: bool = True


class ArchitectureReviewResponse(BaseModel):
    """Response from architecture review."""
    review_id: str
    status: str
    decision: Optional[dict] = None
    gateway: GatewayMetadata


class ArchitectureReviewSummary(BaseModel):
    """Summary of an architecture review."""
    review_id: str
    created_at: datetime
    status: str
    problem_statement_preview: str
    recommended_approach: Optional[str] = None
    confidence: Optional[float] = None
    has_feedback: bool = False


class ArchitectureReviewListResponse(BaseModel):
    """Response listing architecture reviews."""
    reviews: list[ArchitectureReviewSummary]
    total: int
    gateway: GatewayMetadata


class ArchitectureFeedbackRequest(BaseModel):
    """Request to submit feedback on a review."""
    feedback_type: str  # accept, reject, needs_revision
    notes: Optional[str] = Field(default=None, max_length=1000)


class ArchitectureFeedbackResponse(BaseModel):
    """Response from submitting feedback."""
    review_id: str
    feedback_type: str
    message: str
    gateway: GatewayMetadata

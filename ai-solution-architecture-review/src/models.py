"""Data models for AI Solution Architecture Review."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class LatencyLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ScaleLevel(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class DataSensitivity(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    PII = "pii"
    REGULATED = "regulated"


class CostSensitivity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DataAvailability(str, Enum):
    NONE = "none"
    LIMITED = "limited"
    SUFFICIENT = "sufficient"


class TeamMaturity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RecommendedApproach(str, Enum):
    RAG = "rag"
    FINE_TUNING = "fine_tuning"
    RULES = "rules"
    HYBRID = "hybrid"
    NO_AI = "no_ai"


class FeedbackType(str, Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    NEEDS_REVISION = "needs_revision"


class CostEstimate(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ComplianceType(str, Enum):
    HIPAA = "HIPAA"
    SOC2 = "SOC2"
    GDPR = "GDPR"


# Request Models
class Constraints(BaseModel):
    """System constraints for architecture review."""
    latency: LatencyLevel = LatencyLevel.MEDIUM
    scale: ScaleLevel = ScaleLevel.MEDIUM
    data_sensitivity: DataSensitivity = DataSensitivity.INTERNAL
    cost_sensitivity: CostSensitivity = CostSensitivity.MEDIUM
    compliance: list[ComplianceType] = Field(default_factory=list)


class ArchitectureRequest(BaseModel):
    """Request for an architecture review."""
    problem_statement: str = Field(..., min_length=10)
    constraints: Constraints = Field(default_factory=Constraints)
    data_availability: DataAvailability = DataAvailability.LIMITED
    team_maturity: TeamMaturity = TeamMaturity.MEDIUM
    user_notes: Optional[str] = None
    strict_mode: bool = True


class FeedbackRequest(BaseModel):
    """Human feedback on a review."""
    feedback_type: FeedbackType
    notes: Optional[str] = None


# Response Models
class Tradeoff(BaseModel):
    """A single tradeoff in the decision."""
    aspect: str
    pros: list[str]
    cons: list[str]


class Risk(BaseModel):
    """A risk identified in the architecture."""
    risk: str
    severity: str  # low, medium, high
    mitigation: str


class AlternativeConsidered(BaseModel):
    """An alternative approach that was considered."""
    approach: str
    reason_rejected: str


class SystemComponent(BaseModel):
    """A component in the recommended architecture."""
    name: str
    purpose: str
    technology_suggestion: Optional[str] = None


class ArchitectureDecision(BaseModel):
    """The architecture decision output."""
    recommended_approach: RecommendedApproach
    rationale: str
    system_components: list[SystemComponent]
    architecture_flow: str
    tradeoffs: list[Tradeoff]
    risks: list[Risk]
    cost_estimate_level: CostEstimate
    alternatives_considered: list[AlternativeConsidered]
    confidence: float = Field(..., ge=0.0, le=1.0)
    refusal_reason: Optional[str] = None
    missing_information: Optional[list[str]] = None


class ReviewFeedback(BaseModel):
    """Stored feedback for a review."""
    feedback_type: FeedbackType
    notes: Optional[str]
    timestamp: datetime


class ReviewStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    REFUSED = "refused"


class Review(BaseModel):
    """A complete architecture review."""
    review_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: ReviewStatus = ReviewStatus.PENDING
    request: ArchitectureRequest
    decision: Optional[ArchitectureDecision] = None
    feedback_history: list[ReviewFeedback] = Field(default_factory=list)


class ReviewSummary(BaseModel):
    """Summary of a review for listing."""
    review_id: str
    created_at: datetime
    status: ReviewStatus
    problem_statement_preview: str
    recommended_approach: Optional[RecommendedApproach] = None
    confidence: Optional[float] = None
    has_feedback: bool = False


# API Response Models
class ReviewResponse(BaseModel):
    """Response from creating a review."""
    review_id: str
    status: ReviewStatus
    decision: Optional[ArchitectureDecision] = None


class ReviewListResponse(BaseModel):
    """Response listing reviews."""
    reviews: list[ReviewSummary]
    total: int


class FeedbackResponse(BaseModel):
    """Response after submitting feedback."""
    review_id: str
    feedback_type: FeedbackType
    message: str

"""Pydantic models for eval harness."""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class EvalMetricType(str, Enum):
    """Types of evaluation metrics."""
    JSON_VALIDITY = "json_validity"
    CITATION_PRESENCE = "citation_presence"
    CONSISTENCY = "consistency"
    HALLUCINATION_GUARD = "hallucination_guard"


class TestCase(BaseModel):
    """A single test case in an evaluation suite."""
    
    id: str
    name: str
    description: Optional[str] = None
    prompt: str
    context: Optional[str] = None
    expected_schema: Optional[dict] = None
    expected_citations: Optional[bool] = None
    check_consistency: bool = False
    check_hallucination: bool = False
    metadata: dict = Field(default_factory=dict)


class EvalSuite(BaseModel):
    """A collection of test cases."""
    
    name: str
    version: str = "1.0.0"
    description: Optional[str] = None
    test_cases: list[TestCase]
    metadata: dict = Field(default_factory=dict)


class MetricResult(BaseModel):
    """Result of a single metric evaluation."""
    
    metric: EvalMetricType
    passed: bool
    score: float
    details: str
    raw_data: Optional[dict] = None


class TestCaseResult(BaseModel):
    """Result of evaluating a single test case."""
    
    test_case_id: str
    test_case_name: str
    passed: bool
    metrics: list[MetricResult]
    response: str
    latency_ms: float
    error: Optional[str] = None


class EvalRunRequest(BaseModel):
    """Request to run an evaluation."""
    
    suite_path: Optional[str] = None
    suite_inline: Optional[EvalSuite] = None
    model: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "suite_path": "./suites/basic.json",
                "model": "gpt-4o-mini"
            }
        }


class EvalRunResult(BaseModel):
    """Result of a complete evaluation run."""
    
    id: str
    suite_name: str
    model: str
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    total_tests: int
    passed_tests: int
    failed_tests: int
    pass_rate: float
    test_results: list[TestCaseResult]
    regression_detected: bool = False
    metadata: dict = Field(default_factory=dict)


class RunSummary(BaseModel):
    """Summary of an evaluation run."""
    
    id: str
    suite_name: str
    model: str
    completed_at: datetime
    pass_rate: float
    total_tests: int
    regression_detected: bool


class RunsListResponse(BaseModel):
    """Response listing all runs."""
    
    runs: list[RunSummary]
    total_runs: int

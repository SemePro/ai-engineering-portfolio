"""FastAPI application for Secure AI Gateway."""

import uuid
import time
import logging
import json
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

from .config import get_settings
from .models import (
    RAGAskRequest,
    RAGAskResponse,
    EvalRunRequest,
    EvalRunResponse,
    GatewayMetadata,
    GatewayErrorResponse,
    SecurityStatus,
    SecurityCheckResult,
    IncidentIngestRequest,
    IncidentIngestResponse,
    IncidentAnalyzeRequest,
    IncidentAnalyzeResponse,
    IncidentCasesResponse,
    IncidentCaseDetailResponse,
    IncidentCaseSummary,
    IncidentRerunRequest,
    DevOpsIngestRequest,
    DevOpsIngestResponse,
    DevOpsAnalyzeRequest,
    DevOpsAnalyzeResponse,
    DevOpsChangesResponse,
    DevOpsChangeDetailResponse,
    DevOpsChangeSummary,
    DevOpsRerunRequest,
    IncidentFeedbackRequest,
    IncidentFeedbackResponse,
    ArchitectureReviewRequest,
    ArchitectureReviewResponse,
    ArchitectureReviewListResponse,
    ArchitectureReviewSummary,
    ArchitectureFeedbackRequest,
    ArchitectureFeedbackResponse,
)
from .rate_limiter import RateLimiter
from .security import SecurityMiddleware
from .cost import CostEstimator

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s"
)
logger = logging.getLogger(__name__)

# Global instances
rate_limiter: RateLimiter | None = None
security: SecurityMiddleware | None = None
cost_estimator: CostEstimator | None = None


def log_request(
    request_id: str,
    method: str,
    path: str,
    client_ip: str,
    status_code: int,
    latency_ms: float,
    security_status: str,
    extra: dict = None
):
    """Emit structured JSON log."""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "request_id": request_id,
        "method": method,
        "path": path,
        "client_ip": client_ip,
        "status_code": status_code,
        "latency_ms": round(latency_ms, 2),
        "security_status": security_status,
        **(extra or {})
    }
    logger.info(json.dumps(log_entry))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application resources."""
    global rate_limiter, security, cost_estimator
    
    logger.info(json.dumps({
        "event": "startup",
        "service": "secure-ai-gateway"
    }))
    
    settings = get_settings()
    
    rate_limiter = RateLimiter(
        capacity=settings.rate_limit_tokens,
        refill_rate=settings.rate_limit_refill_rate,
        per_ip=settings.rate_limit_per_ip
    )
    
    security = SecurityMiddleware(
        enable_pii_redaction=settings.enable_pii_redaction,
        enable_injection_detection=settings.enable_injection_detection
    )
    
    cost_estimator = CostEstimator()
    
    yield
    
    logger.info(json.dumps({
        "event": "shutdown",
        "service": "secure-ai-gateway"
    }))


app = FastAPI(
    title="Secure AI Gateway",
    description="Production-style AI API gateway with security, rate limiting, and cost tracking",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "secure-ai-gateway"
    }


@app.post("/rag/ask", response_model=RAGAskResponse)
async def rag_ask(request: RAGAskRequest, req: Request):
    """
    Proxy to RAG service with security checks.
    
    - Rate limiting
    - PII redaction
    - Prompt injection detection
    - Cost estimation
    - Structured logging
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    # Rate limiting
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        latency = (time.time() - start_time) * 1000
        log_request(
            request_id, "POST", "/rag/ask", client_ip,
            429, latency, "rate_limited"
        )
        raise HTTPException(
            status_code=429,
            detail=GatewayErrorResponse(
                error="Rate limit exceeded",
                request_id=request_id,
                blocked=True
            ).model_dump()
        )
    
    # Security checks
    processed_question, security_result = security.process(request.question)
    
    if security_result.status == SecurityStatus.BLOCKED:
        latency = (time.time() - start_time) * 1000
        log_request(
            request_id, "POST", "/rag/ask", client_ip,
            403, latency, "blocked",
            {"reason": security_result.blocked_reason}
        )
        raise HTTPException(
            status_code=403,
            detail=GatewayErrorResponse(
                error=security_result.blocked_reason or "Request blocked",
                request_id=request_id,
                blocked=True,
                security=security_result
            ).model_dump()
        )
    
    # Forward to RAG service
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.rag_service_url}/ask",
                json={
                    "question": processed_question,
                    "strict_mode": request.strict_mode,
                    "top_k": request.top_k
                }
            )
            response.raise_for_status()
            rag_response = response.json()
    except httpx.HTTPError as e:
        latency = (time.time() - start_time) * 1000
        log_request(
            request_id, "POST", "/rag/ask", client_ip,
            502, latency, "upstream_error"
        )
        raise HTTPException(
            status_code=502,
            detail=f"RAG service error: {str(e)}"
        )
    
    # Cost estimation
    cost = cost_estimator.estimate(
        request.question,
        rag_response.get("answer", "")
    )
    
    latency = (time.time() - start_time) * 1000
    
    # Build gateway metadata
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=security_result,
        cost=cost,
        rate_limit_remaining=remaining
    )
    
    log_request(
        request_id, "POST", "/rag/ask", client_ip,
        200, latency, security_result.status.value,
        {
            "cost_usd": cost.estimated_cost_usd,
            "tokens": cost.total_tokens
        }
    )
    
    return RAGAskResponse(
        answer=rag_response.get("answer", ""),
        citations=rag_response.get("citations", []),
        confidence_score=rag_response.get("confidence_score", 0),
        strict_mode_triggered=rag_response.get("strict_mode_triggered", False),
        gateway=gateway_meta
    )


@app.post("/eval/run", response_model=EvalRunResponse)
async def eval_run(request: EvalRunRequest, req: Request):
    """
    Proxy to Eval service with security checks.
    
    - Rate limiting
    - Request validation
    - Structured logging
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    # Rate limiting (eval runs cost more)
    allowed, remaining = rate_limiter.check(client_ip, tokens=5)
    if not allowed:
        latency = (time.time() - start_time) * 1000
        log_request(
            request_id, "POST", "/eval/run", client_ip,
            429, latency, "rate_limited"
        )
        raise HTTPException(
            status_code=429,
            detail=GatewayErrorResponse(
                error="Rate limit exceeded",
                request_id=request_id,
                blocked=True
            ).model_dump()
        )
    
    # Forward to Eval service
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.eval_service_url}/runs",
                json=request.model_dump(exclude_none=True)
            )
            response.raise_for_status()
            eval_response = response.json()
    except httpx.HTTPError as e:
        latency = (time.time() - start_time) * 1000
        log_request(
            request_id, "POST", "/eval/run", client_ip,
            502, latency, "upstream_error"
        )
        raise HTTPException(
            status_code=502,
            detail=f"Eval service error: {str(e)}"
        )
    
    latency = (time.time() - start_time) * 1000
    
    # Build gateway metadata (no cost for internal eval)
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    log_request(
        request_id, "POST", "/eval/run", client_ip,
        200, latency, "passed",
        {
            "suite": eval_response.get("suite_name", "unknown"),
            "pass_rate": eval_response.get("pass_rate", 0)
        }
    )
    
    return EvalRunResponse(
        id=eval_response.get("id", ""),
        suite_name=eval_response.get("suite_name", ""),
        pass_rate=eval_response.get("pass_rate", 0),
        total_tests=eval_response.get("total_tests", 0),
        passed_tests=eval_response.get("passed_tests", 0),
        failed_tests=eval_response.get("failed_tests", 0),
        regression_detected=eval_response.get("regression_detected", False),
        gateway=gateway_meta
    )


# ============== INCIDENT INVESTIGATOR ENDPOINTS ==============

@app.post("/incident/ingest", response_model=IncidentIngestResponse)
async def incident_ingest(request: IncidentIngestRequest, req: Request):
    """
    Ingest incident artifacts with security checks.
    
    - Rate limiting
    - PII redaction on artifact content (logs may contain emails/phones)
    - Prompt injection checks on incident_summary
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    # Rate limiting
    allowed, remaining = rate_limiter.check(client_ip, tokens=3)
    if not allowed:
        latency = (time.time() - start_time) * 1000
        log_request(request_id, "POST", "/incident/ingest", client_ip, 429, latency, "rate_limited")
        raise HTTPException(status_code=429, detail=GatewayErrorResponse(
            error="Rate limit exceeded", request_id=request_id, blocked=True
        ).model_dump())
    
    # Security check on incident summary
    processed_summary, security_result = security.process(request.incident_summary)
    
    if security_result.status == SecurityStatus.BLOCKED:
        latency = (time.time() - start_time) * 1000
        log_request(request_id, "POST", "/incident/ingest", client_ip, 403, latency, "blocked")
        raise HTTPException(status_code=403, detail=GatewayErrorResponse(
            error=security_result.blocked_reason or "Request blocked",
            request_id=request_id, blocked=True, security=security_result
        ).model_dump())
    
    # Redact PII from artifact content
    processed_artifacts = []
    for artifact in request.artifacts:
        processed_content, _ = security.process(artifact.content)
        processed_artifacts.append({
            "type": artifact.type,
            "source_id": artifact.source_id,
            "content": processed_content,
            "timestamp": artifact.timestamp.isoformat() if artifact.timestamp else None,
            "metadata": artifact.metadata
        })
    
    # Forward to incident service
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.incident_service_url}/ingest",
                json={
                    "title": request.title,
                    "incident_summary": processed_summary,
                    "artifacts": processed_artifacts
                }
            )
            response.raise_for_status()
            incident_response = response.json()
    except httpx.HTTPError as e:
        latency = (time.time() - start_time) * 1000
        log_request(request_id, "POST", "/incident/ingest", client_ip, 502, latency, "upstream_error")
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=security_result,
        rate_limit_remaining=remaining
    )
    
    log_request(request_id, "POST", "/incident/ingest", client_ip, 200, latency, 
                security_result.status.value, {"case_id": incident_response.get("case_id")})
    
    return IncidentIngestResponse(
        case_id=incident_response.get("case_id", ""),
        title=incident_response.get("title", ""),
        artifacts_indexed=incident_response.get("artifacts_indexed", 0),
        status=incident_response.get("status", ""),
        gateway=gateway_meta
    )


@app.post("/incident/analyze", response_model=IncidentAnalyzeResponse)
async def incident_analyze(request: IncidentAnalyzeRequest, req: Request):
    """
    Analyze incident with security checks.
    
    - Rate limiting (analysis is expensive)
    - Injection check on user_notes
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    # Rate limiting (analysis costs more)
    allowed, remaining = rate_limiter.check(client_ip, tokens=5)
    if not allowed:
        latency = (time.time() - start_time) * 1000
        log_request(request_id, "POST", "/incident/analyze", client_ip, 429, latency, "rate_limited")
        raise HTTPException(status_code=429, detail=GatewayErrorResponse(
            error="Rate limit exceeded", request_id=request_id, blocked=True
        ).model_dump())
    
    # Check user notes for injection
    security_result = SecurityCheckResult(status=SecurityStatus.PASSED)
    processed_notes = request.user_notes
    if request.user_notes:
        processed_notes, security_result = security.process(request.user_notes)
        if security_result.status == SecurityStatus.BLOCKED:
            latency = (time.time() - start_time) * 1000
            log_request(request_id, "POST", "/incident/analyze", client_ip, 403, latency, "blocked")
            raise HTTPException(status_code=403, detail=GatewayErrorResponse(
                error=security_result.blocked_reason or "Request blocked",
                request_id=request_id, blocked=True, security=security_result
            ).model_dump())
    
    # Forward to incident service
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.incident_service_url}/analyze",
                json={
                    "case_id": request.case_id,
                    "strict_mode": request.strict_mode,
                    "top_k": request.top_k,
                    "hypothesis_count": request.hypothesis_count,
                    "focus_area": request.focus_area,
                    "user_notes": processed_notes
                }
            )
            response.raise_for_status()
            incident_response = response.json()
    except httpx.HTTPError as e:
        latency = (time.time() - start_time) * 1000
        log_request(request_id, "POST", "/incident/analyze", client_ip, 502, latency, "upstream_error")
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=security_result,
        rate_limit_remaining=remaining
    )
    
    log_request(request_id, "POST", "/incident/analyze", client_ip, 200, latency,
                security_result.status.value, {
                    "case_id": request.case_id,
                    "confidence": incident_response.get("confidence_overall", 0)
                })
    
    return IncidentAnalyzeResponse(
        case_id=incident_response.get("case_id", ""),
        timeline_events=incident_response.get("timeline_events", []),
        hypotheses=incident_response.get("hypotheses", []),
        what_changed=incident_response.get("what_changed", []),
        recommended_next_steps=incident_response.get("recommended_next_steps", []),
        confidence_overall=incident_response.get("confidence_overall", 0),
        refusal_reason=incident_response.get("refusal_reason"),
        gateway=gateway_meta
    )


@app.get("/incident/cases", response_model=IncidentCasesResponse)
async def incident_list_cases(req: Request):
    """List all incident cases."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.incident_service_url}/cases")
            response.raise_for_status()
            incident_response = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    return IncidentCasesResponse(
        cases=[IncidentCaseSummary(**c) for c in incident_response.get("cases", [])],
        total_cases=incident_response.get("total_cases", 0),
        gateway=gateway_meta
    )


@app.get("/incident/cases/{case_id}", response_model=IncidentCaseDetailResponse)
async def incident_get_case(case_id: str, req: Request):
    """Get incident case details."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.incident_service_url}/cases/{case_id}")
            response.raise_for_status()
            incident_response = response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Case not found")
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    return IncidentCaseDetailResponse(
        case_id=incident_response.get("case_id", ""),
        title=incident_response.get("title", ""),
        incident_summary=incident_response.get("incident_summary", ""),
        status=incident_response.get("status", ""),
        created_at=incident_response.get("created_at"),
        artifacts=incident_response.get("artifacts", []),
        last_analysis=incident_response.get("last_analysis"),
        gateway=gateway_meta
    )


@app.post("/incident/cases/{case_id}/rerun", response_model=IncidentAnalyzeResponse)
async def incident_rerun(case_id: str, request: IncidentRerunRequest, req: Request):
    """Rerun incident analysis with constraints."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip, tokens=5)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Check user notes
    security_result = SecurityCheckResult(status=SecurityStatus.PASSED)
    processed_notes = request.user_notes
    if request.user_notes:
        processed_notes, security_result = security.process(request.user_notes)
        if security_result.status == SecurityStatus.BLOCKED:
            raise HTTPException(status_code=403, detail="Injection detected in user notes")
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.incident_service_url}/cases/{case_id}/rerun",
                json={
                    "strict_mode": request.strict_mode,
                    "top_k": request.top_k,
                    "hypothesis_count": request.hypothesis_count,
                    "focus_area": request.focus_area,
                    "user_notes": processed_notes,
                    "pin_hypothesis": request.pin_hypothesis,
                    "exclude_sources": request.exclude_sources
                }
            )
            response.raise_for_status()
            incident_response = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=security_result,
        rate_limit_remaining=remaining
    )
    
    return IncidentAnalyzeResponse(
        case_id=incident_response.get("case_id", ""),
        timeline_events=incident_response.get("timeline_events", []),
        hypotheses=incident_response.get("hypotheses", []),
        what_changed=incident_response.get("what_changed", []),
        recommended_next_steps=incident_response.get("recommended_next_steps", []),
        confidence_overall=incident_response.get("confidence_overall", 0),
        refusal_reason=incident_response.get("refusal_reason"),
        gateway=gateway_meta
    )


# ============== INCIDENT FEEDBACK ENDPOINT ==============

@app.post("/incident/cases/{case_id}/feedback", response_model=IncidentFeedbackResponse)
async def incident_feedback(case_id: str, request: IncidentFeedbackRequest, req: Request):
    """Submit human feedback on a hypothesis."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Check reviewer note for injection
    security_result = SecurityCheckResult(status=SecurityStatus.PASSED)
    processed_note = request.reviewer_note
    if request.reviewer_note:
        processed_note, security_result = security.process(request.reviewer_note)
        if security_result.status == SecurityStatus.BLOCKED:
            raise HTTPException(status_code=403, detail="Injection detected in reviewer note")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.incident_service_url}/cases/{case_id}/feedback",
                json={
                    "hypothesis_rank": request.hypothesis_rank,
                    "feedback_type": request.feedback_type,
                    "reviewer_note": processed_note
                }
            )
            response.raise_for_status()
            feedback_response = response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Case not found")
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Incident service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=security_result,
        rate_limit_remaining=remaining
    )
    
    return IncidentFeedbackResponse(
        case_id=case_id,
        feedback_id=feedback_response.get("feedback_id", request_id),
        hypothesis_rank=feedback_response.get("hypothesis_rank", request.hypothesis_rank),
        feedback_type=feedback_response.get("feedback_type", request.feedback_type),
        timestamp=feedback_response.get("timestamp", datetime.utcnow().isoformat()),
        gateway=gateway_meta
    )


# ============== DEVOPS CONTROL PLANE ENDPOINTS ==============

@app.post("/devops/changes/ingest", response_model=DevOpsIngestResponse)
async def devops_ingest_change(request: DevOpsIngestRequest, req: Request):
    """
    Ingest a DevOps change with security checks.
    
    - Rate limiting
    - PII redaction on diff_summary and description
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip, tokens=2)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Redact PII from diff summary
    processed_diff, security_result = security.process(request.diff_summary)
    processed_desc = request.description
    if request.description:
        processed_desc, _ = security.process(request.description)
    
    if security_result.status == SecurityStatus.BLOCKED:
        raise HTTPException(status_code=403, detail="Request blocked")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.devops_service_url}/changes/ingest",
                json={
                    "change_type": request.change_type,
                    "service": request.service,
                    "version": request.version,
                    "metadata": request.metadata.model_dump(),
                    "diff_summary": processed_diff,
                    "related_incidents": request.related_incidents,
                    "description": processed_desc
                }
            )
            response.raise_for_status()
            devops_response = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"DevOps service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=security_result,
        rate_limit_remaining=remaining
    )
    
    return DevOpsIngestResponse(
        change_id=devops_response.get("change_id", ""),
        service=devops_response.get("service", ""),
        change_type=devops_response.get("change_type", ""),
        status=devops_response.get("status", ""),
        indexed_chunks=devops_response.get("indexed_chunks", 0),
        gateway=gateway_meta
    )


@app.post("/devops/changes/analyze", response_model=DevOpsAnalyzeResponse)
async def devops_analyze_change(request: DevOpsAnalyzeRequest, req: Request):
    """
    Analyze a DevOps change for risk.
    
    - Rate limiting (analysis is expensive)
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip, tokens=5)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.devops_service_url}/changes/analyze",
                json={
                    "change_id": request.change_id,
                    "strict_mode": request.strict_mode,
                    "focus_area": request.focus_area,
                    "ignore_factors": request.ignore_factors
                }
            )
            response.raise_for_status()
            devops_response = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"DevOps service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    return DevOpsAnalyzeResponse(
        change_id=devops_response.get("change_id", ""),
        service=devops_response.get("service", ""),
        change_type=devops_response.get("change_type", ""),
        assessment=devops_response.get("assessment", {}),
        blast_radius=devops_response.get("blast_radius", []),
        change_velocity=devops_response.get("change_velocity"),
        gateway=gateway_meta
    )


@app.get("/devops/changes", response_model=DevOpsChangesResponse)
async def devops_list_changes(req: Request):
    """List all DevOps changes."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.devops_service_url}/changes")
            response.raise_for_status()
            devops_response = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"DevOps service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    return DevOpsChangesResponse(
        changes=[DevOpsChangeSummary(**c) for c in devops_response.get("changes", [])],
        total_changes=devops_response.get("total_changes", 0),
        gateway=gateway_meta
    )


@app.get("/devops/changes/{change_id}", response_model=DevOpsChangeDetailResponse)
async def devops_get_change(change_id: str, req: Request):
    """Get DevOps change details."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.devops_service_url}/changes/{change_id}")
            response.raise_for_status()
            devops_response = response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Change not found")
        raise HTTPException(status_code=502, detail=f"DevOps service error: {str(e)}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"DevOps service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    return DevOpsChangeDetailResponse(
        change_id=devops_response.get("change_id", ""),
        service=devops_response.get("service", ""),
        change_type=devops_response.get("change_type", ""),
        version=devops_response.get("version"),
        status=devops_response.get("status", ""),
        created_at=devops_response.get("created_at"),
        metadata=devops_response.get("metadata", {}),
        diff_summary=devops_response.get("diff_summary", ""),
        related_incidents=devops_response.get("related_incidents", []),
        last_assessment=devops_response.get("last_assessment"),
        gateway=gateway_meta
    )


# =============================================================================
# Architecture Review Routes
# =============================================================================

@app.post("/architecture/review", response_model=ArchitectureReviewResponse)
async def architecture_review(request: ArchitectureReviewRequest, req: Request):
    """
    Perform an architecture review.
    
    Analyzes problem statement and constraints to recommend
    an appropriate architecture approach.
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Security checks on problem_statement and user_notes
    text_to_check = request.problem_statement
    if request.user_notes:
        text_to_check += " " + request.user_notes
    
    processed_text, security_result = security.process(text_to_check)
    
    if security_result.status == SecurityStatus.BLOCKED:
        log_request(
            request_id=request_id,
            method="POST",
            path="/architecture/review",
            client_ip=client_ip,
            status_code=400,
            latency_ms=(time.time() - start_time) * 1000,
            security_status=security_result.status.value
        )
        raise HTTPException(status_code=400, detail=f"Request blocked: {security_result.blocked_reason}")
    
    # Use processed (PII-redacted) text
    clean_problem, _ = security.process(request.problem_statement)
    clean_notes = None
    if request.user_notes:
        clean_notes, _ = security.process(request.user_notes)
    
    # Forward to architecture service
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.architecture_service_url}/review",
                json={
                    "problem_statement": clean_problem,
                    "constraints": request.constraints.model_dump(),
                    "data_availability": request.data_availability,
                    "team_maturity": request.team_maturity,
                    "user_notes": clean_notes,
                    "strict_mode": request.strict_mode
                }
            )
            response.raise_for_status()
            arch_response = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Architecture service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    cost_meta = cost_estimator.estimate(text_to_check, json.dumps(arch_response))
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=security_result,
        cost=cost_meta,
        rate_limit_remaining=remaining
    )
    
    log_request(
        request_id=request_id,
        method="POST",
        path="/architecture/review",
        client_ip=client_ip,
        status_code=200,
        latency_ms=latency,
        security_status=security_result.status.value,
        extra={"cost_usd": cost_meta.estimated_cost_usd if cost_meta else None}
    )
    
    return ArchitectureReviewResponse(
        review_id=arch_response.get("review_id", ""),
        status=arch_response.get("status", ""),
        decision=arch_response.get("decision"),
        gateway=gateway_meta
    )


@app.get("/architecture/reviews", response_model=ArchitectureReviewListResponse)
async def architecture_list_reviews(req: Request):
    """List all architecture reviews."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.architecture_service_url}/reviews")
            response.raise_for_status()
            arch_response = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Architecture service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    return ArchitectureReviewListResponse(
        reviews=[ArchitectureReviewSummary(**r) for r in arch_response.get("reviews", [])],
        total=arch_response.get("total", 0),
        gateway=gateway_meta
    )


@app.get("/architecture/reviews/{review_id}")
async def architecture_get_review(review_id: str, req: Request):
    """Get architecture review details."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.architecture_service_url}/reviews/{review_id}")
            response.raise_for_status()
            arch_response = response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Review not found")
        raise HTTPException(status_code=502, detail=f"Architecture service error: {str(e)}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Architecture service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    # Return raw review with gateway metadata added
    arch_response["gateway"] = gateway_meta.model_dump(mode="json")
    return arch_response


@app.post("/architecture/reviews/{review_id}/feedback", response_model=ArchitectureFeedbackResponse)
async def architecture_submit_feedback(review_id: str, feedback: ArchitectureFeedbackRequest, req: Request):
    """Submit feedback on an architecture review."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = get_client_ip(req)
    settings = get_settings()
    
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Security check on notes
    if feedback.notes:
        _, security_result = security.process(feedback.notes)
        if security_result.status == SecurityStatus.BLOCKED:
            raise HTTPException(status_code=400, detail=f"Request blocked: {security_result.blocked_reason}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.architecture_service_url}/reviews/{review_id}/feedback",
                json={
                    "feedback_type": feedback.feedback_type,
                    "notes": feedback.notes
                }
            )
            response.raise_for_status()
            arch_response = response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Review not found")
        raise HTTPException(status_code=502, detail=f"Architecture service error: {str(e)}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Architecture service error: {str(e)}")
    
    latency = (time.time() - start_time) * 1000
    
    gateway_meta = GatewayMetadata(
        request_id=request_id,
        timestamp=datetime.utcnow(),
        latency_ms=latency,
        security=SecurityCheckResult(status=SecurityStatus.PASSED),
        rate_limit_remaining=remaining
    )
    
    return ArchitectureFeedbackResponse(
        review_id=review_id,
        feedback_type=arch_response.get("feedback_type", ""),
        message=arch_response.get("message", "Feedback recorded"),
        gateway=gateway_meta
    )


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)

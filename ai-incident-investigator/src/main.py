"""
FastAPI application for AI Incident Investigator.

This service provides incident investigation capabilities:
- Artifact ingestion and indexing
- Timeline reconstruction
- Root cause hypothesis generation
- Evidence citation and confidence scoring
- Human feedback loop
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models import (
    IngestRequest, IngestResponse, AnalyzeRequest, AnalyzeResponse,
    RerunRequest, CasesListResponse, CaseDetail, CaseStatus,
    FeedbackRequest, FeedbackResponse, FeedbackRecord
)
from .case_store import CaseStore
from .vector_store import IncidentVectorStore
from .analyzer import IncidentAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global instances
case_store: CaseStore | None = None
vector_store: IncidentVectorStore | None = None
analyzer: IncidentAnalyzer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application resources."""
    global case_store, vector_store, analyzer
    
    logger.info("Initializing AI Incident Investigator...")
    settings = get_settings()
    
    case_store = CaseStore()
    vector_store = IncidentVectorStore()
    analyzer = IncidentAnalyzer(vector_store)
    
    logger.info(f"Incident Investigator initialized with model: {settings.chat_model}")
    
    yield
    
    logger.info("Shutting down AI Incident Investigator...")


app = FastAPI(
    title="AI Incident Investigator",
    description="Interactive incident investigation system with root cause analysis",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors gracefully without leaking internals."""
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred. Please try again later.",
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    cases = case_store.list_cases() if case_store else []
    return {
        "status": "healthy",
        "service": "ai-incident-investigator",
        "total_cases": len(cases)
    }


@app.post("/ingest", response_model=IngestResponse)
async def ingest_case(request: IngestRequest):
    """
    Ingest a new incident case with artifacts.
    
    Creates a case, stores metadata, and indexes artifacts for retrieval.
    """
    if not case_store or not vector_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Create case
        case_id = case_store.create_case(request)
        
        # Index artifacts
        chunks_indexed = vector_store.index_artifacts(case_id, request.artifacts)
        
        # Update status
        case_store.update_status(case_id, CaseStatus.INGESTED)
        
        logger.info(f"Ingested case {case_id}: {request.title} ({chunks_indexed} chunks)")
        
        return IngestResponse(
            case_id=case_id,
            title=request.title,
            artifacts_indexed=chunks_indexed,
            status=CaseStatus.INGESTED
        )
        
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_case(request: AnalyzeRequest):
    """
    Analyze an incident case and generate root cause hypotheses.
    
    Uses RAG to retrieve relevant evidence and LLM to generate ranked hypotheses.
    With strict_mode, refuses to speculate when evidence is weak.
    """
    if not case_store or not analyzer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    # Get case
    case = case_store.get_case(request.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if case.status == CaseStatus.CREATED:
        raise HTTPException(
            status_code=400, 
            detail="Case not yet ingested. Run /ingest first."
        )
    
    try:
        # Run analysis
        result = analyzer.analyze(
            case_id=request.case_id,
            incident_summary=case.incident_summary,
            artifacts=case.artifacts,
            request=request
        )
        
        # Save results
        case_store.save_analysis(request.case_id, result)
        
        logger.info(
            f"Analyzed case {request.case_id}: "
            f"{len(result.hypotheses)} hypotheses, "
            f"confidence {result.confidence_overall:.2f}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cases", response_model=CasesListResponse)
async def list_cases():
    """List all incident cases."""
    if not case_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    cases = case_store.list_cases()
    return CasesListResponse(cases=cases, total_cases=len(cases))


@app.get("/cases/{case_id}", response_model=CaseDetail)
async def get_case(case_id: str):
    """Get full details for a specific case."""
    if not case_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    return case


@app.post("/cases/{case_id}/rerun", response_model=AnalyzeResponse)
async def rerun_analysis(case_id: str, request: RerunRequest):
    """
    Rerun analysis on a case with new constraints.
    
    Allows pinning a hypothesis or excluding sources.
    """
    if not case_store or not analyzer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Build analyze request from rerun request
    analyze_request = AnalyzeRequest(
        case_id=case_id,
        strict_mode=request.strict_mode,
        top_k=request.top_k,
        hypothesis_count=request.hypothesis_count,
        focus_area=request.focus_area,
        user_notes=request.user_notes
    )
    
    # Add rerun-specific fields
    if request.exclude_sources:
        setattr(analyze_request, 'exclude_sources', request.exclude_sources)
    
    try:
        result = analyzer.analyze(
            case_id=case_id,
            incident_summary=case.incident_summary,
            artifacts=case.artifacts,
            request=analyze_request
        )
        
        case_store.save_analysis(case_id, result)
        
        logger.info(f"Reran analysis for case {case_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"Rerun error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== FEEDBACK ENDPOINTS ==============

@app.post("/cases/{case_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(case_id: str, request: FeedbackRequest):
    """
    Submit human feedback on a hypothesis.
    
    Allows confirming, rejecting, or marking uncertain.
    Feedback is stored with timestamp and reviewer note.
    """
    if not case_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Validate hypothesis rank
    if case.last_analysis:
        max_rank = len(case.last_analysis.hypotheses)
        if request.hypothesis_rank > max_rank:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid hypothesis rank. Max is {max_rank}."
            )
    
    try:
        import uuid
        feedback_record = case_store.add_feedback(case_id, request)
        
        if not feedback_record:
            raise HTTPException(status_code=500, detail="Failed to save feedback")
        
        logger.info(f"Feedback submitted for case {case_id}: {request.feedback_type.value}")
        
        return FeedbackResponse(
            case_id=case_id,
            feedback_id=str(uuid.uuid4()),
            hypothesis_rank=request.hypothesis_rank,
            feedback_type=request.feedback_type,
            timestamp=feedback_record.timestamp
        )
    
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cases/{case_id}/feedback", response_model=list[FeedbackRecord])
async def get_feedback(case_id: str):
    """Get all feedback for a case."""
    if not case_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    if not case_store.case_exists(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    
    return case_store.get_feedback(case_id)


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)

"""
FastAPI application for AI DevOps Control Plane.

This service provides deployment risk assessment:
- Change ingestion and analysis
- Risk scoring based on historical data
- Rollout recommendations
- Incident correlation
"""

import logging
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models import (
    IngestChangeRequest, IngestChangeResponse, AnalyzeChangeRequest,
    AnalyzeChangeResponse, RerunAnalysisRequest, ChangesListResponse,
    ChangeDetail, ChangeStatus
)
from .change_store import ChangeStore
from .vector_store import DevOpsVectorStore
from .analyzer import RiskAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global instances
change_store: ChangeStore | None = None
vector_store: DevOpsVectorStore | None = None
analyzer: RiskAnalyzer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application resources."""
    global change_store, vector_store, analyzer
    
    logger.info("Initializing AI DevOps Control Plane...")
    settings = get_settings()
    
    change_store = ChangeStore()
    vector_store = DevOpsVectorStore()
    analyzer = RiskAnalyzer(vector_store, change_store)
    
    logger.info(f"DevOps Control Plane initialized with model: {settings.chat_model}")
    
    yield
    
    logger.info("Shutting down AI DevOps Control Plane...")


app = FastAPI(
    title="AI DevOps Control Plane",
    description="AI-powered DevOps system for deployment risk assessment and change impact analysis",
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
    changes = change_store.list_changes() if change_store else []
    return {
        "status": "healthy",
        "service": "ai-devops-control-plane",
        "total_changes": len(changes)
    }


@app.post("/changes/ingest", response_model=IngestChangeResponse)
async def ingest_change(request: IngestChangeRequest):
    """
    Ingest a new change for risk assessment.
    
    Creates a change record and indexes it for similarity search.
    """
    if not change_store or not vector_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Create change
        change_id = change_store.create_change(request)
        
        # Index for similarity search
        chunks_indexed = vector_store.index_change(
            change_id=change_id,
            service=request.service,
            change_type=request.change_type.value,
            diff_summary=request.diff_summary,
            description=request.description
        )
        
        logger.info(f"Ingested change {change_id}: {request.service} ({chunks_indexed} chunks)")
        
        return IngestChangeResponse(
            change_id=change_id,
            service=request.service,
            change_type=request.change_type,
            status=ChangeStatus.PENDING,
            indexed_chunks=chunks_indexed
        )
        
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/changes/analyze", response_model=AnalyzeChangeResponse)
async def analyze_change(request: AnalyzeChangeRequest):
    """
    Analyze risk for a change.
    
    Compares against historical changes and incidents to assess risk.
    With strict_mode, refuses to score when evidence is insufficient.
    """
    if not change_store or not analyzer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    # Get change
    change = change_store.get_change(request.change_id)
    if not change:
        raise HTTPException(status_code=404, detail="Change not found")
    
    try:
        # Run analysis
        result = await analyzer.analyze(change, request)
        
        # Save results
        change_store.save_assessment(request.change_id, result)
        
        logger.info(
            f"Analyzed change {request.change_id}: "
            f"risk={result.assessment.risk_level.value}, "
            f"score={result.assessment.risk_score:.2f}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/changes", response_model=ChangesListResponse)
async def list_changes(
    service: Optional[str] = Query(None, description="Filter by service"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level")
):
    """List all changes with optional filters."""
    if not change_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    changes = change_store.list_changes(service=service, risk_level=risk_level)
    return ChangesListResponse(changes=changes, total_changes=len(changes))


@app.get("/changes/{change_id}", response_model=ChangeDetail)
async def get_change(change_id: str):
    """Get full details for a specific change."""
    if not change_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    change = change_store.get_change(change_id)
    if not change:
        raise HTTPException(status_code=404, detail="Change not found")
    
    return change


@app.post("/changes/{change_id}/rerun", response_model=AnalyzeChangeResponse)
async def rerun_analysis(change_id: str, request: RerunAnalysisRequest):
    """
    Rerun risk analysis with new constraints.
    
    Allows focusing on specific areas or ignoring certain factors.
    """
    if not change_store or not analyzer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    change = change_store.get_change(change_id)
    if not change:
        raise HTTPException(status_code=404, detail="Change not found")
    
    # Build analyze request from rerun request
    analyze_request = AnalyzeChangeRequest(
        change_id=change_id,
        strict_mode=request.strict_mode,
        focus_area=request.focus_area,
        ignore_factors=request.ignore_factors
    )
    
    try:
        result = await analyzer.analyze(change, analyze_request)
        change_store.save_assessment(change_id, result)
        
        logger.info(f"Reran analysis for change {change_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"Rerun error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)

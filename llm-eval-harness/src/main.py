"""FastAPI application for LLM Eval Harness."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from .config import get_settings
from .models import (
    EvalRunRequest,
    EvalRunResult,
    RunsListResponse
)
from .runner import EvalRunner

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application resources."""
    logger.info("Initializing LLM Eval Harness...")
    settings = get_settings()
    
    # Ensure directories exist
    Path(settings.runs_directory).mkdir(parents=True, exist_ok=True)
    Path(settings.suites_directory).mkdir(parents=True, exist_ok=True)
    
    yield
    
    logger.info("Shutting down LLM Eval Harness...")


app = FastAPI(
    title="LLM Eval Harness",
    description="Automated LLM evaluation and regression testing",
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


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    runner = EvalRunner()
    runs = runner.list_runs()
    return {
        "status": "healthy",
        "service": "llm-eval-harness",
        "total_runs": len(runs)
    }


@app.post("/runs", response_model=EvalRunResult)
async def create_run(request: EvalRunRequest):
    """
    Run an evaluation suite.
    
    Either provide suite_path (path to JSON file) or suite_inline (inline suite definition).
    """
    try:
        runner = EvalRunner(model=request.model)
        
        if request.suite_inline:
            suite = request.suite_inline
        elif request.suite_path:
            suite = runner.load_suite(request.suite_path)
        else:
            raise HTTPException(
                status_code=400,
                detail="Either suite_path or suite_inline must be provided"
            )
        
        logger.info(f"Starting evaluation run for suite: {suite.name}")
        result = runner.run_suite(suite)
        
        logger.info(
            f"Evaluation complete: {result.passed_tests}/{result.total_tests} passed "
            f"({result.pass_rate:.1%})"
        )
        
        return result
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Suite file not found")
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/runs/latest", response_model=EvalRunResult)
async def get_latest_run():
    """Get the most recent evaluation run."""
    runner = EvalRunner()
    result = runner.get_latest_run()
    
    if not result:
        raise HTTPException(status_code=404, detail="No runs found")
    
    return result


@app.get("/runs/{run_id}", response_model=EvalRunResult)
async def get_run(run_id: str):
    """Get a specific evaluation run by ID."""
    runner = EvalRunner()
    result = runner.get_run(run_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return result


@app.get("/runs", response_model=RunsListResponse)
async def list_runs():
    """List all evaluation runs."""
    runner = EvalRunner()
    summaries = runner.list_runs()
    
    return RunsListResponse(
        runs=summaries,
        total_runs=len(summaries)
    )


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)

"""
FastAPI application for AI Solution Architecture Review.

This service analyzes problem statements and constraints to recommend
appropriate AI system architectures — including when AI should NOT be used.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import (
    ArchitectureRequest,
    FeedbackRequest,
    Review,
    ReviewResponse,
    ReviewListResponse,
    FeedbackResponse,
    ReviewStatus,
)
from .review_store import ReviewStore
from .vector_store import PatternVectorStore
from .analyzer import ArchitectureAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global instances (initialized in lifespan)
review_store: ReviewStore | None = None
vector_store: PatternVectorStore | None = None
analyzer: ArchitectureAnalyzer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application resources."""
    global review_store, vector_store, analyzer
    
    logger.info("Initializing AI Solution Architecture Review service...")
    
    review_store = ReviewStore()
    vector_store = PatternVectorStore()
    analyzer = ArchitectureAnalyzer(vector_store)
    
    logger.info("Architecture Review service initialized successfully")
    
    yield
    
    logger.info("Shutting down Architecture Review service...")


app = FastAPI(
    title="AI Solution Architecture Review",
    description="AI-powered architecture review and decision support system",
    version="1.0.0",
    lifespan=lifespan,
)

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
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred. Please try again later.",
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    reviews_count = len(review_store.list_reviews()) if review_store else 0
    return {
        "status": "healthy",
        "service": "architecture-review",
        "reviews_count": reviews_count
    }


@app.post("/review", response_model=ReviewResponse)
async def create_review(request: ArchitectureRequest):
    """
    Perform an architecture review.
    
    Analyzes the problem statement and constraints to recommend
    an appropriate architecture approach (RAG, fine-tuning, rules, hybrid, or no-AI).
    
    Args:
        request: Architecture review request with problem statement and constraints
        
    Returns:
        ReviewResponse with the recommended approach and detailed decision
        
    Raises:
        HTTPException: 503 if service not initialized, 500 for analysis errors
    """
    if not analyzer or not review_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Create review record
        review = Review(request=request)
        
        # Perform analysis
        decision = analyzer.analyze(request)
        review.decision = decision
        
        # Set status based on result
        if decision.refusal_reason:
            review.status = ReviewStatus.REFUSED
        else:
            review.status = ReviewStatus.COMPLETED
        
        # Persist
        review_store.save_review(review)
        
        logger.info(f"Created review {review.review_id}: {decision.recommended_approach.value}")
        
        return ReviewResponse(
            review_id=review.review_id,
            status=review.status,
            decision=decision,
        )
        
    except Exception as e:
        logger.error(f"Review creation error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to complete architecture review"
        )


@app.get("/reviews", response_model=ReviewListResponse)
async def list_reviews():
    """
    List all architecture reviews.
    
    Returns summaries of all reviews, sorted by creation date (newest first).
    
    Returns:
        ReviewListResponse with list of review summaries
    """
    if not review_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    summaries = review_store.list_reviews()
    return ReviewListResponse(reviews=summaries, total=len(summaries))


@app.get("/reviews/{review_id}")
async def get_review(review_id: str):
    """
    Get full details of a specific review.
    
    Includes the original request, decision, and any feedback.
    
    Args:
        review_id: Unique identifier for the review
        
    Returns:
        Full Review object with request, decision, and feedback history
        
    Raises:
        HTTPException: 404 if review not found
    """
    if not review_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    review = review_store.get_review(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@app.post("/reviews/{review_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(review_id: str, feedback: FeedbackRequest):
    """
    Submit human feedback on a review.
    
    Allows accepting, rejecting, or marking a review as needing revision.
    Human decision is always final.
    
    Args:
        review_id: Unique identifier for the review
        feedback: Feedback type and optional notes
        
    Returns:
        FeedbackResponse confirming the feedback was recorded
        
    Raises:
        HTTPException: 404 if review not found
    """
    if not review_store:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    success = review_store.save_feedback(
        review_id=review_id,
        feedback_type=feedback.feedback_type,
        notes=feedback.notes,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Review not found")
    
    logger.info(f"Feedback recorded for review {review_id}: {feedback.feedback_type.value}")
    
    return FeedbackResponse(
        review_id=review_id,
        feedback_type=feedback.feedback_type,
        message=f"Feedback '{feedback.feedback_type.value}' recorded successfully",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)

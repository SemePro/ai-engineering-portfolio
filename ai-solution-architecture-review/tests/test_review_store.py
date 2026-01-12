"""Tests for review store."""
import pytest
import tempfile
import shutil
from pathlib import Path

from src.models import (
    ArchitectureRequest,
    Review,
    ReviewStatus,
    FeedbackType,
    Constraints,
    DataAvailability,
    TeamMaturity,
)
from src.review_store import ReviewStore


@pytest.fixture
def temp_reviews_dir():
    """Create temporary directory for reviews."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def review_store(temp_reviews_dir):
    """Create review store with temp directory."""
    return ReviewStore(reviews_dir=temp_reviews_dir)


@pytest.fixture
def sample_request():
    """Create sample architecture request."""
    return ArchitectureRequest(
        problem_statement="Build a customer support chatbot using our documentation",
        constraints=Constraints(),
        data_availability=DataAvailability.SUFFICIENT,
        team_maturity=TeamMaturity.MEDIUM,
    )


def test_save_and_load_review(review_store, sample_request):
    """Test saving and loading a review."""
    review = Review(request=sample_request, status=ReviewStatus.PENDING)
    review_store.save_review(review)
    
    loaded = review_store.get_review(review.review_id)
    assert loaded is not None
    assert loaded.review_id == review.review_id
    assert loaded.request.problem_statement == sample_request.problem_statement


def test_list_reviews(review_store, sample_request):
    """Test listing reviews."""
    # Create multiple reviews
    for i in range(3):
        review = Review(request=sample_request, status=ReviewStatus.COMPLETED)
        review_store.save_review(review)
    
    summaries = review_store.list_reviews()
    assert len(summaries) == 3


def test_feedback_persistence(review_store, sample_request):
    """Test saving feedback to a review."""
    review = Review(request=sample_request, status=ReviewStatus.COMPLETED)
    review_store.save_review(review)
    
    # Add feedback
    success = review_store.save_feedback(
        review_id=review.review_id,
        feedback_type=FeedbackType.ACCEPT,
        notes="Good recommendation",
    )
    assert success is True
    
    # Verify feedback was saved
    loaded = review_store.get_review(review.review_id)
    assert len(loaded.feedback_history) == 1
    assert loaded.feedback_history[0].feedback_type == FeedbackType.ACCEPT
    assert loaded.feedback_history[0].notes == "Good recommendation"


def test_feedback_nonexistent_review(review_store):
    """Test feedback on non-existent review fails gracefully."""
    success = review_store.save_feedback(
        review_id="nonexistent-id",
        feedback_type=FeedbackType.REJECT,
    )
    assert success is False


def test_delete_review(review_store, sample_request):
    """Test deleting a review."""
    review = Review(request=sample_request)
    review_store.save_review(review)
    
    # Delete
    success = review_store.delete_review(review.review_id)
    assert success is True
    
    # Verify deleted
    loaded = review_store.get_review(review.review_id)
    assert loaded is None

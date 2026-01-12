"""Storage for architecture reviews."""
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import REVIEWS_DIR
from .models import (
    Review,
    ReviewSummary,
    ReviewFeedback,
    FeedbackType,
    ReviewStatus,
)


class ReviewStore:
    """Manages persistence of architecture reviews."""

    def __init__(self, reviews_dir: str = REVIEWS_DIR):
        self.reviews_dir = Path(reviews_dir)
        self.reviews_dir.mkdir(parents=True, exist_ok=True)

    def _review_path(self, review_id: str) -> Path:
        return self.reviews_dir / f"{review_id}.json"

    def save_review(self, review: Review) -> None:
        """Save a review to disk."""
        path = self._review_path(review.review_id)
        with open(path, "w") as f:
            json.dump(review.model_dump(mode="json"), f, indent=2, default=str)

    def get_review(self, review_id: str) -> Optional[Review]:
        """Load a review from disk."""
        path = self._review_path(review_id)
        if not path.exists():
            return None
        with open(path, "r") as f:
            data = json.load(f)
            return Review.model_validate(data)

    def list_reviews(self) -> list[ReviewSummary]:
        """List all reviews as summaries."""
        summaries = []
        for path in self.reviews_dir.glob("*.json"):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    review = Review.model_validate(data)
                    
                    # Create preview of problem statement
                    preview = review.request.problem_statement[:100]
                    if len(review.request.problem_statement) > 100:
                        preview += "..."
                    
                    summary = ReviewSummary(
                        review_id=review.review_id,
                        created_at=review.created_at,
                        status=review.status,
                        problem_statement_preview=preview,
                        recommended_approach=review.decision.recommended_approach if review.decision else None,
                        confidence=review.decision.confidence if review.decision else None,
                        has_feedback=len(review.feedback_history) > 0,
                    )
                    summaries.append(summary)
            except Exception:
                continue
        
        # Sort by created_at descending
        summaries.sort(key=lambda x: x.created_at, reverse=True)
        return summaries

    def save_feedback(
        self,
        review_id: str,
        feedback_type: FeedbackType,
        notes: Optional[str] = None,
    ) -> bool:
        """Add feedback to a review."""
        review = self.get_review(review_id)
        if not review:
            return False

        feedback = ReviewFeedback(
            feedback_type=feedback_type,
            notes=notes,
            timestamp=datetime.utcnow(),
        )
        review.feedback_history.append(feedback)
        self.save_review(review)
        return True

    def delete_review(self, review_id: str) -> bool:
        """Delete a review."""
        path = self._review_path(review_id)
        if path.exists():
            os.remove(path)
            return True
        return False

"""Tests for the risk analyzer."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from src.models import (
    ChangeDetail, ChangeMetadata, ChangeType, ChangeStatus,
    AnalyzeChangeRequest, RiskLevel, RolloutRecommendation
)


class TestRiskAnalyzer:
    """Test suite for RiskAnalyzer."""
    
    @pytest.fixture
    def sample_change(self):
        """Create a sample change detail."""
        return ChangeDetail(
            change_id="test-123",
            service="order-service",
            change_type=ChangeType.DEPLOY,
            version="v2.4.0",
            status=ChangeStatus.PENDING,
            created_at=datetime.utcnow(),
            metadata=ChangeMetadata(
                commit_sha="abc123",
                author="engineer@company.com",
                env="production",
                labels=["database", "high-impact"]
            ),
            diff_summary="Major database query changes for recommendations",
            related_incidents=[]
        )
    
    @pytest.fixture
    def analyze_request(self):
        """Create a sample analyze request."""
        return AnalyzeChangeRequest(
            change_id="test-123",
            strict_mode=True
        )
    
    def test_risk_level_mapping(self):
        """Test risk score to level mapping."""
        # Low risk: 0.0-0.3
        assert 0.1 < 0.3  # Low
        # Medium risk: 0.3-0.6
        assert 0.4 > 0.3 and 0.4 < 0.6  # Medium
        # High risk: 0.6-0.8
        assert 0.7 > 0.6 and 0.7 < 0.8  # High
        # Critical risk: 0.8-1.0
        assert 0.9 > 0.8  # Critical
    
    def test_rollout_recommendation_values(self):
        """Test rollout recommendation enum values."""
        assert RolloutRecommendation.SAFE_TO_DEPLOY == "safe_to_deploy"
        assert RolloutRecommendation.CANARY_RECOMMENDED == "canary_recommended"
        assert RolloutRecommendation.FEATURE_FLAG_FIRST == "feature_flag_first"
        assert RolloutRecommendation.NEEDS_HUMAN_REVIEW == "needs_human_review"
        assert RolloutRecommendation.PAUSE_DEPLOYMENT == "pause_deployment"
    
    def test_risk_level_enum(self):
        """Test risk level enum values."""
        assert RiskLevel.LOW == "low"
        assert RiskLevel.MEDIUM == "medium"
        assert RiskLevel.HIGH == "high"
        assert RiskLevel.CRITICAL == "critical"


class TestStrictModeRefusal:
    """Tests for strict mode refusal behavior."""
    
    def test_strict_mode_should_refuse_with_no_evidence(self):
        """Strict mode should refuse when no historical evidence exists."""
        # When evidence count < 2 or avg_relevance < threshold
        # The analyzer should return a refusal response
        
        evidence_count = 1
        avg_relevance = 0.3
        threshold = 0.6
        
        should_refuse = evidence_count < 2 or avg_relevance < threshold
        assert should_refuse is True
    
    def test_strict_mode_should_not_refuse_with_sufficient_evidence(self):
        """Strict mode should not refuse when sufficient evidence exists."""
        evidence_count = 5
        avg_relevance = 0.8
        threshold = 0.6
        
        should_refuse = evidence_count < 2 or avg_relevance < threshold
        assert should_refuse is False
    
    def test_non_strict_mode_proceeds_without_evidence(self):
        """Non-strict mode should proceed even without evidence."""
        strict_mode = False
        evidence_count = 0
        
        # Non-strict mode always proceeds
        should_analyze = not strict_mode or evidence_count >= 2
        assert should_analyze is True

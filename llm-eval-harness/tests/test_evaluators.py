"""Tests for evaluation metric implementations."""

import pytest
from src.models import TestCase, EvalMetricType
from src.evaluators import JSONValidityEvaluator, CitationPresenceEvaluator


class TestJSONValidityEvaluator:
    """Tests for JSON validity evaluation."""
    
    @pytest.fixture
    def evaluator(self):
        return JSONValidityEvaluator()
    
    def test_valid_json_matches_schema(self, evaluator):
        """Valid JSON matching schema should pass."""
        test_case = TestCase(
            id="test-1",
            name="JSON Test",
            prompt="Generate JSON",
            expected_schema={
                "type": "object",
                "required": ["name"],
                "properties": {"name": {"type": "string"}}
            }
        )
        response = '{"name": "Alice"}'
        
        result = evaluator.evaluate(response, test_case)
        
        assert result.passed is True
        assert result.score == 1.0
        assert result.metric == EvalMetricType.JSON_VALIDITY
    
    def test_invalid_json_fails(self, evaluator):
        """Invalid JSON should fail."""
        test_case = TestCase(
            id="test-1",
            name="JSON Test",
            prompt="Generate JSON",
            expected_schema={"type": "object"}
        )
        response = "This is not JSON {broken"
        
        result = evaluator.evaluate(response, test_case)
        
        assert result.passed is False
        assert result.score == 0.0
    
    def test_schema_mismatch_partial_fail(self, evaluator):
        """Valid JSON not matching schema should partially fail."""
        test_case = TestCase(
            id="test-1",
            name="JSON Test",
            prompt="Generate JSON",
            expected_schema={
                "type": "object",
                "required": ["name", "age"],
                "properties": {
                    "name": {"type": "string"},
                    "age": {"type": "number"}
                }
            }
        )
        response = '{"name": "Alice"}'  # Missing required 'age'
        
        result = evaluator.evaluate(response, test_case)
        
        assert result.passed is False
        assert result.score == 0.5  # Partial credit for valid JSON
    
    def test_no_schema_always_passes(self, evaluator):
        """No schema requirement should always pass."""
        test_case = TestCase(
            id="test-1",
            name="Test",
            prompt="Test",
            expected_schema=None
        )
        
        result = evaluator.evaluate("Any response", test_case)
        
        assert result.passed is True
        assert result.score == 1.0
    
    def test_json_embedded_in_text(self, evaluator):
        """JSON embedded in text should be extracted and validated."""
        test_case = TestCase(
            id="test-1",
            name="JSON Test",
            prompt="Generate JSON",
            expected_schema={
                "type": "object",
                "properties": {"value": {"type": "number"}}
            }
        )
        response = 'Here is the JSON: {"value": 42} as requested.'
        
        result = evaluator.evaluate(response, test_case)
        
        assert result.passed is True


class TestCitationPresenceEvaluator:
    """Tests for citation presence evaluation."""
    
    @pytest.fixture
    def evaluator(self):
        return CitationPresenceEvaluator()
    
    def test_citation_found_bracket_source(self, evaluator):
        """Should detect [Source: ...] citations."""
        test_case = TestCase(
            id="test-1",
            name="Citation Test",
            prompt="Answer with citations",
            expected_citations=True
        )
        response = "The policy states 20 days vacation [Source: hr-policy.md]."
        
        result = evaluator.evaluate(response, test_case)
        
        assert result.passed is True
        assert len(result.raw_data["citations"]) >= 1
    
    def test_citation_found_doc_reference(self, evaluator):
        """Should detect [Document N] citations."""
        test_case = TestCase(
            id="test-1",
            name="Citation Test",
            prompt="Answer with citations",
            expected_citations=True
        )
        response = "According to the policy [Document 1], you get 20 days."
        
        result = evaluator.evaluate(response, test_case)
        
        assert result.passed is True
    
    def test_no_citation_when_expected(self, evaluator):
        """Should fail when citations expected but not found."""
        test_case = TestCase(
            id="test-1",
            name="Citation Test",
            prompt="Answer with citations",
            expected_citations=True
        )
        response = "You get 20 days of vacation per year."
        
        result = evaluator.evaluate(response, test_case)
        
        assert result.passed is False
        assert result.score == 0.0
    
    def test_citation_not_required(self, evaluator):
        """Should pass when citations not required."""
        test_case = TestCase(
            id="test-1",
            name="Test",
            prompt="Answer",
            expected_citations=None
        )
        
        result = evaluator.evaluate("No citations here", test_case)
        
        assert result.passed is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

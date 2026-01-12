"""Evaluation metric implementations."""

import json
import re
from typing import Optional
import jsonschema
from openai import OpenAI

from .config import get_settings
from .models import MetricResult, EvalMetricType, TestCase


class BaseEvaluator:
    """Base class for evaluators."""
    
    def evaluate(self, response: str, test_case: TestCase) -> MetricResult:
        """Evaluate a response against a test case."""
        raise NotImplementedError


class JSONValidityEvaluator(BaseEvaluator):
    """Evaluates if response is valid JSON matching expected schema."""
    
    def evaluate(self, response: str, test_case: TestCase) -> MetricResult:
        """Check if response is valid JSON and matches schema."""
        if not test_case.expected_schema:
            return MetricResult(
                metric=EvalMetricType.JSON_VALIDITY,
                passed=True,
                score=1.0,
                details="No schema validation required"
            )
        
        try:
            # Try to parse JSON from the response
            json_match = re.search(r'\{[\s\S]*\}|\[[\s\S]*\]', response)
            if not json_match:
                return MetricResult(
                    metric=EvalMetricType.JSON_VALIDITY,
                    passed=False,
                    score=0.0,
                    details="No JSON found in response"
                )
            
            parsed = json.loads(json_match.group())
            
            # Validate against schema
            jsonschema.validate(parsed, test_case.expected_schema)
            
            return MetricResult(
                metric=EvalMetricType.JSON_VALIDITY,
                passed=True,
                score=1.0,
                details="JSON is valid and matches schema",
                raw_data={"parsed_json": parsed}
            )
            
        except json.JSONDecodeError as e:
            return MetricResult(
                metric=EvalMetricType.JSON_VALIDITY,
                passed=False,
                score=0.0,
                details=f"Invalid JSON: {str(e)}"
            )
        except jsonschema.ValidationError as e:
            return MetricResult(
                metric=EvalMetricType.JSON_VALIDITY,
                passed=False,
                score=0.5,
                details=f"Schema validation failed: {e.message}"
            )


class CitationPresenceEvaluator(BaseEvaluator):
    """Evaluates if response contains proper citations."""
    
    # Common citation patterns
    CITATION_PATTERNS = [
        r'\[Source:.*?\]',
        r'\[.*?\.md\]',
        r'\[.*?\.txt\]',
        r'\[Doc(?:ument)?\s*\d+\]',
        r'According to.*?document',
        r'Based on.*?source',
        r'\(Source:.*?\)',
    ]
    
    def evaluate(self, response: str, test_case: TestCase) -> MetricResult:
        """Check if response contains citations."""
        if test_case.expected_citations is None:
            return MetricResult(
                metric=EvalMetricType.CITATION_PRESENCE,
                passed=True,
                score=1.0,
                details="No citation check required"
            )
        
        found_citations = []
        for pattern in self.CITATION_PATTERNS:
            matches = re.findall(pattern, response, re.IGNORECASE)
            found_citations.extend(matches)
        
        has_citations = len(found_citations) > 0
        
        if test_case.expected_citations:
            # Expected citations, check if present
            if has_citations:
                return MetricResult(
                    metric=EvalMetricType.CITATION_PRESENCE,
                    passed=True,
                    score=1.0,
                    details=f"Found {len(found_citations)} citation(s)",
                    raw_data={"citations": found_citations}
                )
            else:
                return MetricResult(
                    metric=EvalMetricType.CITATION_PRESENCE,
                    passed=False,
                    score=0.0,
                    details="Expected citations but none found"
                )
        else:
            # Not expecting citations
            return MetricResult(
                metric=EvalMetricType.CITATION_PRESENCE,
                passed=True,
                score=1.0,
                details="Citations not required"
            )


class ConsistencyEvaluator(BaseEvaluator):
    """Evaluates consistency across multiple runs of the same prompt."""
    
    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base
        )
        self.model = settings.default_model
        self.num_runs = settings.consistency_runs
    
    def _get_response(self, prompt: str, context: Optional[str] = None) -> str:
        """Get a response from the model."""
        messages = []
        if context:
            messages.append({"role": "system", "content": context})
        messages.append({"role": "user", "content": prompt})
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7  # Some variation expected
        )
        return response.choices[0].message.content or ""
    
    def _calculate_similarity(self, responses: list[str]) -> float:
        """Calculate semantic similarity between responses using LLM."""
        if len(responses) < 2:
            return 1.0
        
        # Use LLM to judge consistency
        comparison_prompt = f"""Compare these {len(responses)} responses for semantic consistency.
Are they conveying the same core information and meaning?

Responses:
{chr(10).join(f'{i+1}. {r[:500]}' for i, r in enumerate(responses))}

Rate the consistency from 0 to 1 where:
- 1.0 = All responses convey identical meaning
- 0.5 = Responses have some differences but core message is similar
- 0.0 = Responses contradict each other

Respond with just a number between 0 and 1."""

        try:
            result = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": comparison_prompt}],
                temperature=0
            )
            score_text = result.choices[0].message.content or "0.5"
            return float(score_text.strip())
        except (ValueError, TypeError):
            return 0.5
    
    def evaluate(self, response: str, test_case: TestCase) -> MetricResult:
        """Run multiple times and check consistency."""
        if not test_case.check_consistency:
            return MetricResult(
                metric=EvalMetricType.CONSISTENCY,
                passed=True,
                score=1.0,
                details="Consistency check not required"
            )
        
        # Collect multiple responses
        responses = [response]  # Include the original response
        for _ in range(self.num_runs - 1):
            try:
                new_response = self._get_response(
                    test_case.prompt,
                    test_case.context
                )
                responses.append(new_response)
            except Exception as e:
                return MetricResult(
                    metric=EvalMetricType.CONSISTENCY,
                    passed=False,
                    score=0.0,
                    details=f"Error during consistency check: {str(e)}"
                )
        
        similarity = self._calculate_similarity(responses)
        passed = similarity >= 0.7
        
        return MetricResult(
            metric=EvalMetricType.CONSISTENCY,
            passed=passed,
            score=similarity,
            details=f"Consistency score: {similarity:.2f} across {len(responses)} runs",
            raw_data={"responses": responses, "similarity": similarity}
        )


class HallucinationGuardEvaluator(BaseEvaluator):
    """Evaluates if response contains information not in the provided context."""
    
    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base
        )
        self.model = settings.default_model
        self.threshold = settings.hallucination_threshold
    
    def evaluate(self, response: str, test_case: TestCase) -> MetricResult:
        """Check if response contains hallucinated information."""
        if not test_case.check_hallucination:
            return MetricResult(
                metric=EvalMetricType.HALLUCINATION_GUARD,
                passed=True,
                score=1.0,
                details="Hallucination check not required"
            )
        
        if not test_case.context:
            return MetricResult(
                metric=EvalMetricType.HALLUCINATION_GUARD,
                passed=True,
                score=1.0,
                details="No context provided for hallucination check"
            )
        
        # Use LLM to detect hallucination
        check_prompt = f"""Analyze if the Response contains any claims or information NOT supported by the Context.

Context:
{test_case.context}

Response:
{response}

Instructions:
1. Identify any factual claims in the Response
2. Check if each claim is supported by the Context
3. Rate groundedness from 0 to 1:
   - 1.0 = All claims are fully supported by context
   - 0.5 = Some claims are unsupported or extrapolated
   - 0.0 = Major claims contradict or are not in context

Respond with just a number between 0 and 1, representing groundedness score."""

        try:
            result = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": check_prompt}],
                temperature=0
            )
            score_text = result.choices[0].message.content or "0.5"
            score = float(score_text.strip())
        except (ValueError, TypeError):
            score = 0.5
        
        passed = score >= self.threshold
        
        return MetricResult(
            metric=EvalMetricType.HALLUCINATION_GUARD,
            passed=passed,
            score=score,
            details=f"Groundedness score: {score:.2f} (threshold: {self.threshold})",
            raw_data={"groundedness": score, "threshold": self.threshold}
        )


class EvaluatorFactory:
    """Factory for creating evaluators."""
    
    _evaluators: dict[EvalMetricType, BaseEvaluator] = {}
    
    @classmethod
    def get_evaluator(cls, metric_type: EvalMetricType) -> BaseEvaluator:
        """Get or create an evaluator instance."""
        if metric_type not in cls._evaluators:
            if metric_type == EvalMetricType.JSON_VALIDITY:
                cls._evaluators[metric_type] = JSONValidityEvaluator()
            elif metric_type == EvalMetricType.CITATION_PRESENCE:
                cls._evaluators[metric_type] = CitationPresenceEvaluator()
            elif metric_type == EvalMetricType.CONSISTENCY:
                cls._evaluators[metric_type] = ConsistencyEvaluator()
            elif metric_type == EvalMetricType.HALLUCINATION_GUARD:
                cls._evaluators[metric_type] = HallucinationGuardEvaluator()
            else:
                raise ValueError(f"Unknown metric type: {metric_type}")
        
        return cls._evaluators[metric_type]

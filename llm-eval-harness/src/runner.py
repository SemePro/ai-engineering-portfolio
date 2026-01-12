"""Evaluation run execution engine."""

import json
import time
import uuid
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from openai import OpenAI

from .config import get_settings
from .models import (
    EvalSuite,
    EvalRunResult,
    TestCase,
    TestCaseResult,
    MetricResult,
    EvalMetricType,
    RunSummary
)
from .evaluators import EvaluatorFactory


class EvalRunner:
    """Runs evaluation suites and collects results."""
    
    def __init__(self, model: Optional[str] = None):
        """Initialize the runner."""
        self.settings = get_settings()
        self.model = model or self.settings.default_model
        
        self.client = OpenAI(
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_api_base
        )
        
        # Ensure runs directory exists
        Path(self.settings.runs_directory).mkdir(parents=True, exist_ok=True)
    
    def _get_response(self, prompt: str, context: Optional[str] = None) -> tuple[str, float]:
        """Get a response from the model and measure latency."""
        messages = []
        if context:
            messages.append({"role": "system", "content": context})
        messages.append({"role": "user", "content": prompt})
        
        start = time.time()
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3
        )
        latency_ms = (time.time() - start) * 1000
        
        return response.choices[0].message.content or "", latency_ms
    
    def _evaluate_test_case(self, test_case: TestCase) -> TestCaseResult:
        """Run a single test case and evaluate all applicable metrics."""
        try:
            # Get model response
            response, latency_ms = self._get_response(
                test_case.prompt,
                test_case.context
            )
            
            # Collect metric results
            metrics: list[MetricResult] = []
            
            # JSON validity check
            if test_case.expected_schema:
                evaluator = EvaluatorFactory.get_evaluator(EvalMetricType.JSON_VALIDITY)
                metrics.append(evaluator.evaluate(response, test_case))
            
            # Citation check
            if test_case.expected_citations is not None:
                evaluator = EvaluatorFactory.get_evaluator(EvalMetricType.CITATION_PRESENCE)
                metrics.append(evaluator.evaluate(response, test_case))
            
            # Consistency check
            if test_case.check_consistency:
                evaluator = EvaluatorFactory.get_evaluator(EvalMetricType.CONSISTENCY)
                metrics.append(evaluator.evaluate(response, test_case))
            
            # Hallucination check
            if test_case.check_hallucination:
                evaluator = EvaluatorFactory.get_evaluator(EvalMetricType.HALLUCINATION_GUARD)
                metrics.append(evaluator.evaluate(response, test_case))
            
            # Overall pass/fail
            passed = all(m.passed for m in metrics) if metrics else True
            
            return TestCaseResult(
                test_case_id=test_case.id,
                test_case_name=test_case.name,
                passed=passed,
                metrics=metrics,
                response=response,
                latency_ms=latency_ms
            )
            
        except Exception as e:
            return TestCaseResult(
                test_case_id=test_case.id,
                test_case_name=test_case.name,
                passed=False,
                metrics=[],
                response="",
                latency_ms=0,
                error=str(e)
            )
    
    def run_suite(self, suite: EvalSuite) -> EvalRunResult:
        """Run a complete evaluation suite."""
        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        started_at = datetime.now()
        
        # Run all test cases
        test_results = []
        for test_case in suite.test_cases:
            result = self._evaluate_test_case(test_case)
            test_results.append(result)
        
        completed_at = datetime.now()
        duration = (completed_at - started_at).total_seconds()
        
        # Calculate summary
        passed_tests = sum(1 for r in test_results if r.passed)
        failed_tests = len(test_results) - passed_tests
        pass_rate = passed_tests / len(test_results) if test_results else 0.0
        
        result = EvalRunResult(
            id=run_id,
            suite_name=suite.name,
            model=self.model,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration,
            total_tests=len(test_results),
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            pass_rate=pass_rate,
            test_results=test_results,
            regression_detected=pass_rate < 0.8,  # Simple threshold
            metadata=suite.metadata
        )
        
        # Save result
        self._save_result(result)
        
        return result
    
    def _save_result(self, result: EvalRunResult) -> None:
        """Save evaluation result to disk."""
        file_path = Path(self.settings.runs_directory) / f"{result.id}.json"
        with open(file_path, "w") as f:
            f.write(result.model_dump_json(indent=2))
    
    def load_suite(self, suite_path: str) -> EvalSuite:
        """Load an evaluation suite from a JSON file."""
        with open(suite_path, "r") as f:
            data = json.load(f)
        return EvalSuite(**data)
    
    def get_run(self, run_id: str) -> Optional[EvalRunResult]:
        """Load a run result by ID."""
        file_path = Path(self.settings.runs_directory) / f"{run_id}.json"
        if not file_path.exists():
            return None
        
        with open(file_path, "r") as f:
            data = json.load(f)
        return EvalRunResult(**data)
    
    def get_latest_run(self) -> Optional[EvalRunResult]:
        """Get the most recent run result."""
        runs_dir = Path(self.settings.runs_directory)
        if not runs_dir.exists():
            return None
        
        run_files = sorted(runs_dir.glob("run_*.json"), reverse=True)
        if not run_files:
            return None
        
        with open(run_files[0], "r") as f:
            data = json.load(f)
        return EvalRunResult(**data)
    
    def list_runs(self) -> list[RunSummary]:
        """List all runs with summary info."""
        runs_dir = Path(self.settings.runs_directory)
        if not runs_dir.exists():
            return []
        
        summaries = []
        for run_file in sorted(runs_dir.glob("run_*.json"), reverse=True):
            try:
                with open(run_file, "r") as f:
                    data = json.load(f)
                    summaries.append(RunSummary(
                        id=data["id"],
                        suite_name=data["suite_name"],
                        model=data["model"],
                        completed_at=datetime.fromisoformat(data["completed_at"]),
                        pass_rate=data["pass_rate"],
                        total_tests=data["total_tests"],
                        regression_detected=data.get("regression_detected", False)
                    ))
            except (json.JSONDecodeError, KeyError):
                continue
        
        return summaries

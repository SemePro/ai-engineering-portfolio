# LLM Eval Harness

Automated evaluation and regression testing framework for LLM outputs.

## Overview

LLMs are non-deterministic. Traditional testing doesn't work. This harness provides structured evaluation with metrics that matter:
- **JSON Schema Validity**: Does the output match expected structure?
- **Citation Presence**: Are sources cited when expected?
- **Consistency**: Does the same prompt give similar answers?
- **Hallucination Detection**: Is the answer grounded in context?

## Architecture

```
┌─────────────────┐
│  Test Suite     │  (JSON definition)
│  - Test cases   │
│  - Expectations │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Eval Runner   │
│  - Run prompts  │
│  - Collect resp │
│  - Apply metrics│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ JSON  │ │Results│
│ Store │ │  API  │
└───────┘ └───────┘
```

## Key Features

- **Declarative Test Suites**: Define tests as JSON
- **Multiple Metrics**: Schema validation, citations, consistency, hallucination
- **CLI and API**: Run from terminal or integrate via HTTP
- **Historical Tracking**: Store and compare runs over time
- **CI Integration**: Fail builds on regression

## Why This Matters

Production LLM systems need:
- **Regression detection**: Catch degradation before users do
- **Structured validation**: Ensure JSON outputs match schemas
- **Consistency checks**: Flag unstable responses
- **Audit trail**: Historical record of model behavior

## Evaluation Metrics

### JSON Schema Validity
Validates that structured outputs match expected schemas.
```json
{
  "expected_schema": {
    "type": "object",
    "required": ["name", "age"],
    "properties": { ... }
  }
}
```

### Citation Presence
Checks for source citations in responses.
```json
{
  "expected_citations": true
}
```

### Consistency
Runs the same prompt multiple times and compares responses.
```json
{
  "check_consistency": true
}
```

### Hallucination Guard
Evaluates if response is grounded in provided context.
```json
{
  "check_hallucination": true,
  "context": "The source material..."
}
```

## CLI Usage

### Run a Suite
```bash
python -m src.cli run --suite ./suites/basic.json
```

### With Output File
```bash
python -m src.cli run \
  --suite ./suites/basic.json \
  --out ./runs/my_run.json
```

### Fail on Regression (for CI)
```bash
python -m src.cli run \
  --suite ./suites/basic.json \
  --fail-on-regression
```

### List Previous Runs
```bash
python -m src.cli list
```

### Show Run Details
```bash
python -m src.cli show run_20240115_123456_abc123
```

## API Endpoints

### POST /runs
Start an evaluation run.

```bash
curl -X POST http://localhost:8002/runs \
  -H "Content-Type: application/json" \
  -d '{"suite_path": "./suites/basic.json"}'
```

### GET /runs/latest
Get the most recent run result.

### GET /runs/{id}
Get a specific run by ID.

### GET /runs
List all runs with summaries.

## Test Suite Format

```json
{
  "name": "Basic Evaluation Suite",
  "version": "1.0.0",
  "test_cases": [
    {
      "id": "json-001",
      "name": "JSON Output Test",
      "prompt": "Generate a JSON user object",
      "expected_schema": { ... }
    },
    {
      "id": "citation-001",
      "name": "Citation Test",
      "prompt": "Answer based on context",
      "context": "...",
      "expected_citations": true
    }
  ]
}
```

## Tradeoffs & Design Decisions

### Simplified (for portfolio)
- **LLM-as-judge for consistency**: Production might use embedding similarity
- **Simple hallucination detection**: Could use NLI models
- **File-based storage**: Production would use a database

### Would Improve in Production
- **Parallel test execution**: Run tests concurrently
- **Custom metric plugins**: Allow user-defined evaluators
- **Baseline comparison**: Compare against previous runs automatically
- **Cost tracking**: Monitor API spend per evaluation

## Local Setup

### With Docker
```bash
docker build -t llm-eval-harness .
docker run -p 8002:8002 \
  -e OPENAI_API_KEY=your-key \
  llm-eval-harness
```

### Without Docker
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your OPENAI_API_KEY
uvicorn src.main:app --port 8002 --reload
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `DEFAULT_MODEL` | Model for evaluations | `gpt-4o-mini` |
| `CONSISTENCY_RUNS` | Runs for consistency check | `3` |
| `HALLUCINATION_THRESHOLD` | Groundedness threshold | `0.8` |
| `RUNS_DIRECTORY` | Where to store results | `./runs` |
| `SUITES_DIRECTORY` | Where suites are stored | `./suites` |

## Testing

```bash
pytest tests/ -v
```

Tests cover:
- JSON validity evaluator
- Citation detection patterns
- Metric result structures

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Evaluation
  run: |
    python -m src.cli run \
      --suite ./suites/basic.json \
      --fail-on-regression
```

The `--fail-on-regression` flag exits with code 1 if pass rate drops below 80%.

## Deployment Notes

### Railway
1. Set root directory to `llm-eval-harness`
2. Add `OPENAI_API_KEY` environment variable
3. Mount volume for `/app/runs` to persist results

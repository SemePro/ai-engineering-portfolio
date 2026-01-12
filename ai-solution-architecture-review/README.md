# AI Solution Architecture Review

An AI-powered architecture review system that analyzes problem statements and recommends appropriate AI system architectures — including when AI should NOT be used.

## Overview

This is a **decision support system**, not an automation system. It translates requirements into architecture decisions, explains tradeoffs, evaluates feasibility, and keeps humans in control at all times.

**This is NOT a chatbot.** It's a structured architecture review tool that produces decisions, explanations, and constraints rather than conversational responses.

## Architecture Decision Philosophy

The system follows these principles:

1. **AI is not always the answer** — The system explicitly recommends non-AI solutions when appropriate
2. **Evidence over speculation** — Recommendations require stated constraints and available information
3. **Strict refusal when uncertain** — If critical information is missing, the system refuses to guess
4. **Human decision is final** — All recommendations include feedback mechanisms for human override
5. **Explainability required** — Every recommendation includes rationale, tradeoffs, and alternatives

## Key Features

- **Constraint-aware analysis**: Evaluates latency, scale, data sensitivity, cost, and compliance requirements
- **Approach recommendations**: RAG, fine-tuning, rules-based, hybrid, or explicit "no AI" recommendations
- **Pattern matching**: Uses RAG over stored architecture patterns to find similar past decisions
- **Tradeoff analysis**: Explicit pros/cons for the recommended approach
- **Risk identification**: Highlights risks with severity and mitigation strategies
- **Alternative evaluation**: Explains why other approaches were rejected
- **Confidence scoring**: Quantifies how much information the recommendation is based on
- **Human feedback**: Accept, reject, or request revision of recommendations

## Why This Matters

In real engineering organizations:

- AI projects fail when the wrong architecture is chosen
- LLMs are overused for problems that need deterministic solutions
- Compliance and latency requirements are often discovered too late
- Teams lack a structured way to evaluate AI vs. non-AI approaches

This system provides a structured review process before implementation begins.

## Failure Modes Addressed

| Failure Mode | How Addressed |
|--------------|---------------|
| Recommending AI when rules suffice | Explicit "no_ai" and "rules" recommendations |
| Ignoring compliance requirements | Compliance flags block inappropriate recommendations |
| Guessing without data | Strict mode refusal when data_availability is "none" |
| Vague requirements proceeding | Feasibility check rejects insufficient problem statements |
| No consideration of alternatives | Required "alternatives_considered" in every decision |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/review` | Perform an architecture review |
| GET | `/reviews` | List all past reviews |
| GET | `/reviews/{id}` | Get full review details |
| POST | `/reviews/{id}/feedback` | Submit human feedback |

## Data Models

### ArchitectureRequest

```python
{
  "problem_statement": "Description of what you want to build",
  "constraints": {
    "latency": "low | medium | high",
    "scale": "small | medium | large",
    "data_sensitivity": "public | internal | pii | regulated",
    "cost_sensitivity": "low | medium | high",
    "compliance": ["HIPAA", "SOC2", "GDPR"]
  },
  "data_availability": "none | limited | sufficient",
  "team_maturity": "low | medium | high",
  "user_notes": "Optional additional context",
  "strict_mode": true
}
```

### ArchitectureDecision

```python
{
  "recommended_approach": "rag | fine_tuning | rules | hybrid | no_ai",
  "rationale": "Why this approach was chosen",
  "system_components": [...],
  "architecture_flow": "Step-by-step data flow",
  "tradeoffs": [...],
  "risks": [...],
  "cost_estimate_level": "low | medium | high",
  "alternatives_considered": [...],
  "confidence": 0.0-1.0,
  "refusal_reason": "If refusing to recommend",
  "missing_information": ["What's needed to proceed"]
}
```

## Tradeoffs & Design Decisions

### What Was Simplified

- Pattern database is seeded with common patterns (not learned from real reviews)
- Cost estimation is qualitative (low/medium/high) not quantitative
- No integration with actual code or infrastructure analysis

### What Would Be Different in Production

- Connect to real architecture decision records
- Integrate with cloud cost calculators
- Add team skill assessment integration
- Implement approval workflows
- Add architecture diagram generation

## Local Setup

```bash
# With Docker Compose (recommended)
docker compose up --build

# Standalone
cd ai-solution-architecture-review
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8005
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `CHAT_MODEL` | Chat model to use | `gpt-4o-mini` |
| `EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |
| `REVIEWS_DIR` | Directory for review storage | `./reviews` |
| `CHROMA_DIR` | Directory for ChromaDB | `./chroma_db` |

## Testing

```bash
cd ai-solution-architecture-review
pip install pytest pytest-asyncio
pytest tests/ -v
```

## Deployment

- **Railway**: Deploy as a standalone service
- **Docker**: Use the provided Dockerfile
- **Gateway**: Access through the Secure AI Gateway on `/architecture/*` routes

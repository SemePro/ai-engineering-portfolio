# AI DevOps Control Plane

## Overview

The AI DevOps Control Plane is an intelligent system that evaluates deployment risk before changes reach production. By analyzing CI/CD pipelines, deploy events, configuration changes, and historical incidents, it provides risk scores, evidence-based explanations, and rollout recommendations.

Unlike simple rule-based checks, this system uses RAG (Retrieval-Augmented Generation) to compare incoming changes against historical patterns—identifying when a change is similar to past failures and refusing to guess when evidence is insufficient.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI DevOps Control Plane                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    FastAPI Application                     │  │
│  │                                                            │  │
│  │  POST /changes/ingest    - Ingest a new change            │  │
│  │  POST /changes/analyze   - Analyze risk                   │  │
│  │  GET  /changes           - List changes                   │  │
│  │  GET  /changes/{id}      - Get change details             │  │
│  │  POST /changes/{id}/rerun - Rerun with constraints        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐     │
│  │Change Store │    │Risk Analyzer│    │  Vector Store   │     │
│  │ (JSON/Disk) │    │  (LLM+RAG)  │    │  (ChromaDB)     │     │
│  └─────────────┘    └─────────────┘    └─────────────────┘     │
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                          │
│                    │ Incident Service│                          │
│                    │ (Similar Cases) │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Risk Scoring** - Evaluates changes on a 0-100% scale with risk levels (low, medium, high, critical)
- **Historical Comparison** - Compares changes against past deployments using vector similarity
- **Incident Integration** - Fetches similar past incidents from the AI Incident Investigator
- **Rollout Recommendations** - Suggests deployment strategies (canary, feature flag, pause, etc.)
- **Blast Radius Analysis** - Identifies services that may be affected
- **Strict Mode** - Refuses to score when evidence is insufficient
- **Evidence Citations** - Every risk factor cites supporting evidence

## Risk Model

| Risk Level | Score Range | Description |
|------------|-------------|-------------|
| Low | 0-30% | Routine change with no concerning patterns |
| Medium | 30-60% | Some risk factors or unknowns present |
| High | 60-80% | Similar to past failures, extra caution needed |
| Critical | 80-100% | High probability of impact, do not proceed |

## Rollout Recommendations

| Recommendation | When Used |
|----------------|-----------|
| Safe to Deploy | Low risk, no concerning patterns |
| Canary Recommended | Medium risk, deploy to subset first |
| Feature Flag First | Can be toggled off quickly |
| Needs Human Review | Requires SRE/on-call approval |
| Pause Deployment | Critical risk, do not proceed |

## Why This Matters

Real DevOps teams face:
- **Change Fatigue** - Too many deployments to manually review each one
- **Hidden Dependencies** - Changes in one service affect others unexpectedly
- **Forgotten History** - Engineers don't remember incidents from months ago
- **Pressure to Ship** - Business pressure overrides caution

This system provides:
- Automated first-pass risk assessment for every change
- Institutional memory via historical incident integration
- Evidence-based reasoning for approval/rejection decisions
- Consistent, unbiased risk evaluation

## Tradeoffs & Design Decisions

### What Was Simplified
- **No CI/CD Integration** - Requires manual ingestion (could add webhooks)
- **Keyword-Based Similarity** - Uses keyword matching for incident lookup (could use embeddings)
- **LLM-Inferred Blast Radius** - Not topology-aware (could use service mesh data)

### Production Improvements
- Direct integration with GitHub/GitLab/ArgoCD
- Service dependency graph for accurate blast radius
- Deployment blocking with manual override
- Post-deployment monitoring feedback loop
- Custom risk thresholds per team/service

## Local Setup

### Prerequisites
- Python 3.11+
- OpenAI API key

### Installation

```bash
cd ai-devops-control-plane
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Running

```bash
uvicorn src.main:app --reload --port 8004
```

### With Docker

```bash
docker build -t ai-devops-control-plane .
docker run -p 8004:8004 -e OPENAI_API_KEY=$OPENAI_API_KEY ai-devops-control-plane
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_API_BASE` | OpenAI API base URL | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | Model for embeddings | `text-embedding-3-small` |
| `CHAT_MODEL` | Model for chat | `gpt-4o-mini` |
| `INCIDENT_SERVICE_URL` | Incident Investigator URL | `http://localhost:8003` |
| `CONFIDENCE_THRESHOLD` | Strict mode threshold | `0.6` |

## Testing

```bash
pytest tests/ -v
```

## Deployment Notes

### Docker Compose

Included in the root `docker-compose.yml`:
- Service: `devops` on port 8004
- Depends on: `incident` service
- Volumes: `devops-changes`, `devops-chroma`

### Railway

1. Connect GitHub repository
2. Set environment variables
3. Configure persistent volumes for `/app/changes` and `/app/chroma_db`
4. Deploy

## API Examples

### Ingest a Change

```bash
curl -X POST http://localhost:8004/changes/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "change_type": "deploy",
    "service": "order-service",
    "version": "v2.4.0",
    "diff_summary": "Added new recommendation queries...",
    "metadata": {
      "author": "engineer@company.com",
      "env": "production"
    }
  }'
```

### Analyze Risk

```bash
curl -X POST http://localhost:8004/changes/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "<change_id>",
    "strict_mode": true,
    "focus_area": "database"
  }'
```

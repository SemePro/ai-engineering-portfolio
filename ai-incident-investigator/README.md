# AI Incident Investigator

An interactive incident investigation system that ingests artifacts (logs, alerts, deploy history, runbooks), reconstructs timelines, and generates ranked root-cause hypotheses with evidence citations, confidence scoring, and strict refusal when evidence is weak.

## Overview

The AI Incident Investigator helps SRE and DevOps teams during incident response by:

1. **Ingesting incident artifacts** - Logs, alerts, deploy history, runbooks, metrics
2. **Reconstructing timelines** - Parsing and ordering events by timestamp
3. **Generating hypotheses** - Using RAG + LLM to propose root causes
4. **Citing evidence** - Every claim backed by concrete excerpts
5. **Refusing speculation** - Strict mode prevents hallucination when evidence is weak

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Next.js UI    │────▶│  Secure Gateway  │────▶│ Incident Service  │
│ (Interactive)   │     │  (PII, Injection)│     │   (FastAPI)       │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                                                         │
                    ┌────────────────────────────────────┼────────────────┐
                    │                                    ▼                │
                    │  ┌─────────────┐   ┌─────────────────────────────┐ │
                    │  │   Parsers   │──▶│      Vector Store           │ │
                    │  │ (Timeline)  │   │   (ChromaDB per case)       │ │
                    │  └─────────────┘   └─────────────────────────────┘ │
                    │         │                         │                 │
                    │         ▼                         ▼                 │
                    │  ┌─────────────────────────────────────────────┐   │
                    │  │              Analysis Engine                 │   │
                    │  │  - Evidence retrieval (RAG)                  │   │
                    │  │  - Hypothesis generation (LLM)               │   │
                    │  │  - Strict mode refusal                       │   │
                    │  └─────────────────────────────────────────────┘   │
                    └─────────────────────────────────────────────────────┘
```

## Features

### Timeline Reconstruction
- Parses timestamps from multiple formats (ISO 8601, syslog, Unix)
- Detects error patterns (exceptions, timeouts, OOM, pool exhaustion)
- Identifies deploy events (versions, rollbacks, config changes)
- Extracts alerts with severity levels

### Evidence-Based Hypotheses
- Each hypothesis cites at least 2 evidence excerpts
- Confidence scoring based on retrieval relevance
- Counter-evidence surfacing for balanced analysis
- Tests-to-confirm for hypothesis validation

### Strict Mode
- Refuses to speculate when evidence is insufficient
- Returns recommended next steps for data collection
- Configurable confidence threshold (default: 0.6)

### Interactive Analysis
- Focus areas (database, auth, network, deployment)
- Adjustable top-k retrieval and hypothesis count
- Rerun analysis with constraints (exclude sources, pin hypothesis)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest` | Ingest a new incident case with artifacts |
| POST | `/analyze` | Analyze a case and generate hypotheses |
| GET | `/cases` | List all incident cases |
| GET | `/cases/{id}` | Get full case details |
| POST | `/cases/{id}/rerun` | Rerun analysis with new constraints |
| GET | `/health` | Health check |

## Why This Matters

### For Recruiters
This project demonstrates:
- **Applied AI Engineering**: RAG, embeddings, LLM prompt engineering
- **Production Safety**: Strict mode, evidence requirements, refusal behavior
- **System Design**: Multi-service architecture with gateway integration
- **Real-world Use Case**: Incident response is a critical ops function

### Failure Modes Addressed
1. **Hallucination** - Strict evidence requirements, refusal when weak
2. **Injection** - Gateway filters on free-text fields
3. **PII Leakage** - Automatic redaction in artifact content
4. **Overconfidence** - Counter-evidence surfacing, confidence scoring

## Tradeoffs

### Current Design
- **JSON file storage** - Simple, works for demo; production needs PostgreSQL
- **Regex parsers** - Fast, works for common formats; complex logs need extension
- **Per-case ChromaDB** - Isolated, but less efficient than shared index

### Future Improvements
- Direct integration with log aggregators (Datadog, Splunk)
- Multi-turn conversational investigation
- Historical incident pattern matching
- Automated runbook execution

## Setup

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=https://api.openai.com/v1  # Optional
EMBEDDING_MODEL=text-embedding-3-small
CHAT_MODEL=gpt-4o-mini
```

### Local Development

```bash
cd ai-incident-investigator
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run server
uvicorn src.main:app --reload --port 8003
```

### Docker

```bash
docker build -t ai-incident-investigator .
docker run -p 8003:8003 -e OPENAI_API_KEY=$OPENAI_API_KEY ai-incident-investigator
```

### With Docker Compose (Full Stack)

```bash
# From project root
docker compose up --build
```

## Testing

```bash
pytest tests/ -v
```

### Test Coverage
- Parser tests (timestamp extraction, error detection)
- Case store tests (CRUD operations)
- Integration tests (API endpoints)

## Sample Data

The `data/sample_incidents/` directory contains realistic synthetic incidents:

1. **DB Connection Pool Exhaustion** - Deploy with heavier queries causes pool exhaustion
2. **Auth Token Clock Skew** - Container base image change breaks NTP sync

Load these via the UI or API to test the system.

## Deployment

### Railway
```bash
# Deploy via Railway CLI
railway init
railway up
```

### Environment Setup
1. Set `OPENAI_API_KEY` in Railway secrets
2. Configure persistent volumes for `/app/cases` and `/app/chroma_db`

## License

MIT

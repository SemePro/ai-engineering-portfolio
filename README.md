# AI Engineer Portfolio

A cohesive AI portfolio demonstrating production-grade LLM engineering: RAG systems, evaluation pipelines, security gateways, and modern DevOps practices.

## Overview

This portfolio showcases applied LLM engineering with a focus on:
- **Reliability**: Systems that work correctly and fail gracefully
- **Evaluation**: Automated testing to prevent regressions
- **Security**: Defense-in-depth with guardrails at every layer
- **Observability**: Structured logging, cost tracking, and monitoring

## Architecture

```
┌─────────────────┐
│  Portfolio Web  │  (Next.js - Vercel)
│   Port 3000     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Secure Gateway  │  (FastAPI - Railway)
│   Port 8000     │
│  • Rate Limit   │
│  • Security     │
│  • Cost Track   │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬─────────┐
    ▼         ▼          ▼         ▼
┌───────┐ ┌───────┐ ┌──────────┐ ┌──────────┐
│  RAG  │ │ Eval  │ │ Incident │ │  DevOps  │ (FastAPI - Railway)
│ 8001  │ │ 8002  │ │   8003   │ │   8004   │
└───────┘ └───────┘ └──────────┘ └──────────┘
```

## Projects

| Project | Description | Tech |
|---------|-------------|------|
| [ai-portfolio-web](./ai-portfolio-web) | Public portfolio website with live demos | Next.js, TypeScript, TailwindCSS |
| [rag-knowledge-assistant](./rag-knowledge-assistant) | Enterprise RAG with citations and strict mode | FastAPI, ChromaDB, OpenAI |
| [llm-eval-harness](./llm-eval-harness) | Automated LLM evaluation and regression testing | FastAPI, Click CLI, JSONSchema |
| [secure-ai-gateway](./secure-ai-gateway) | Production API gateway with security controls | FastAPI, Token Bucket, PII Detection |
| [ai-incident-investigator](./ai-incident-investigator) | Root cause analysis with evidence-based hypotheses | FastAPI, RAG, LLM, ChromaDB |
| [ai-devops-control-plane](./ai-devops-control-plane) | Deployment risk assessment with historical analysis | FastAPI, ChromaDB, RAG, LLM |

## Quick Start

### Prerequisites
- Docker and Docker Compose
- OpenAI API key

### Run Locally

1. **Clone and configure:**
```bash
git clone https://github.com/yourusername/ai-engineer-portfolio.git
cd ai-engineer-portfolio
cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

2. **Start all services:**
```bash
docker compose up --build
```

3. **Access the applications:**
- Portfolio Website: http://localhost:3000
- Secure Gateway: http://localhost:8000
- RAG Service: http://localhost:8001
- Eval Service: http://localhost:8002
- Incident Investigator: http://localhost:8003
- DevOps Control Plane: http://localhost:8004

### Ingest Sample Documents

```bash
curl -X POST http://localhost:8001/ingest \
  -H "Content-Type: application/json" \
  -d @rag-knowledge-assistant/data/sample_documents.json
```

### Run Evaluation Suite

```bash
cd llm-eval-harness
python -m src.cli run --suite ./suites/basic.json
```

## System Flow

1. **User** interacts with the portfolio website
2. **Web frontend** sends requests to the Secure Gateway
3. **Gateway** applies security checks:
   - Rate limiting (token bucket)
   - Prompt injection detection
   - PII redaction
   - Cost estimation
4. **Gateway** proxies to backend services:
   - RAG for knowledge queries
   - Eval for running test suites
5. **Response** flows back with metadata (cost, latency, security status)

## CI/CD Strategy

### Continuous Integration
- Automated tests on every PR
- Linting (ruff for Python, ESLint for TypeScript)
- Docker build verification
- All checks must pass before merge

### LLM Evaluation
- Weekly scheduled evaluation runs
- Manual trigger for pre-release validation
- Fail build on regression detection
- Historical results stored as artifacts

### Deployment
- **Web**: Vercel (automatic on main branch)
- **APIs**: Railway (Docker-based deployment)
- Environment variables managed per environment

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_API_BASE` | OpenAI API base URL | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | Model for embeddings | `text-embedding-3-small` |
| `CHAT_MODEL` | Model for chat completions | `gpt-4o-mini` |

## 2-Week Execution Timeline

### Week 1
- ✅ Repo scaffolding and project structure
- ✅ RAG core pipeline (chunking, embeddings, retrieval)
- ✅ Basic UI and chat demo
- ✅ Docker Compose for local development

### Week 2
- ✅ Eval harness with CLI and API
- ✅ Secure gateway middleware
- ✅ Polished UI with all demo pages
- ✅ Final READMEs and documentation
- ✅ CI/CD pipelines

## License

MIT License - see individual project READMEs for details.

---

Built to demonstrate production-grade AI engineering practices.

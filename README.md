# AI Engineering Portfolio — Kodjo Seme Semeglo

Production-minded AI systems: a tool-using incident response agent, the shared gateway every model
call goes through, and the evaluation and failure-injection harnesses used to decide whether the
systems can be trusted. Live site: **https://www.semefit.com**

## Start here

**[incident-agent/](incident-agent/)** — Agentic Incident Response Engine (flagship).
A Claude-based agent investigates alerts with read-only tools, reports a root cause with a confidence
or says the evidence is insufficient, and can only *propose* rollbacks/restarts that a human approves
through a server-enforced gate. Ships with a 14-scenario synthetic incident lab, fault injection and
an evaluation harness. Start with its [README](incident-agent/README.md).

**Reviewer path:** [case study](https://www.semefit.com/projects/incident-agent) → architecture →
[recorded run](https://www.semefit.com/projects/incident-agent/trace) →
[evaluation](https://www.semefit.com/projects/incident-agent/evals) → failure cases → security boundary →
[code + README](incident-agent/).

## Platform

```
                 ┌──────────────────────────┐
 AI apps ──────► │    Secure AI Gateway     │ ──────► model providers
 (agent, RAG,    │ service-key auth · $/day │         (Anthropic; OpenAI
  eval, review)  │ budgets · rate limits ·  │          for older services)
                 │ PII redaction · retries ·│
                 │ token/cost accounting ·  │
                 │ audit log                │
                 └──────────────────────────┘
```

| Project | What it is | Stack |
| --- | --- | --- |
| [incident-agent](incident-agent/) | Agentic incident investigation with gated write actions, incident lab, eval harness | FastAPI, Anthropic SDK (Claude), Pydantic |
| [secure-ai-gateway](secure-ai-gateway/) | Shared gateway: Anthropic-compatible `/v1/messages` route with auth, budgets, PII redaction, accounting; plus proxy routes for the older services | FastAPI, token bucket |
| [llm-eval-harness](llm-eval-harness/) | Regression suites for LLM outputs | FastAPI, Click |
| [rag-knowledge-assistant](rag-knowledge-assistant/) | RAG with citations and strict refusal | FastAPI, ChromaDB, OpenAI |
| [ai-incident-investigator](ai-incident-investigator/) | v1 incident analysis (single-pass RAG); predecessor of incident-agent | FastAPI, ChromaDB, OpenAI |
| [ai-devops-control-plane](ai-devops-control-plane/) | Pre-deploy change risk analysis | FastAPI, ChromaDB, OpenAI |
| [ai-solution-architecture-review](ai-solution-architecture-review/) | Architecture recommendations with trade-offs | FastAPI, ChromaDB, OpenAI |
| [ai-portfolio-web](ai-portfolio-web/) | The website: case studies, trace viewer, eval dashboard, testing section | Next.js 14, TypeScript, Tailwind |

## Run

```bash
# Flagship, no API key needed
cd incident-agent && pip install -e ".[dev]" && pytest && python -m incident_agent.evals.run --suite smoke

# Everything
cp .env.example .env        # add keys
docker compose up --build
```

Ports: web 3000 · gateway 8000 · rag 8001 · eval 8002 · incident v1 8003 · devops 8004 ·
architecture 8005 · incident-agent 8006.

## CI

- `.github/workflows/pr-checks.yml` — every PR, no model spend: agent tests (incl. authorization and
  budget tests), deterministic smoke eval with golden thresholds, gateway and legacy service tests,
  web lint/typecheck/build/Playwright, Docker builds.
- `.github/workflows/agent-eval.yml` — manual only, paid: full Claude evaluation through the gateway
  with fallback disabled and a hard dollar cap (requires the `ANTHROPIC_API_KEY` repository secret).
- `.github/workflows/scheduled-prod-tests.yml` — nightly Playwright/Cypress smoke against production.

## Deployment

Web on Vercel (deploys from `main`), APIs on Railway. The incident agent is not deployed as a
service; the website replays recorded evaluation traces as static files.

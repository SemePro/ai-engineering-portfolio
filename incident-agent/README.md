# Agentic Incident Response Engine

A Claude-based investigation agent for production alerts. Given only an alert, it chooses which
read-only tools to call (logs, metrics, change history, service health, past incidents), revises
hypotheses as evidence arrives, and reports a root cause with a confidence — or reports that the
evidence is insufficient. It can **propose** a rollback or restart; execution requires a human
approval that the backend verifies.

It ships with a synthetic incident lab (14 scenarios with known root causes and distractors), fault
injection, and an evaluation harness that grades the agent against ground truth and a no-LLM baseline.

```
Alert ─► Incident Agent ──(Anthropic SDK, base_url=gateway)──► Secure AI Gateway ──► Claude
             │  read tools (direct, read-only)                    auth · $ budget · PII redaction
             │  logs · metrics · changes · health · incident KB   retries · token/cost · audit
             │
             └─ write tools ─► proposal ─► approval gate ─► sandbox execution ─► audit log
                               (never executed by the agent)   signed token · scope · params hash · expiry
```

**Reviewer path (≈10 minutes):** [case study](https://www.semefit.com/projects/incident-agent) →
[replay a recorded run](https://www.semefit.com/projects/incident-agent/trace) →
[evaluation results](https://www.semefit.com/projects/incident-agent/evals) →
[failure injection](docs/FAILURE_INJECTION.md) → [safety boundary](docs/SAFETY.md) →
code: [`agent.py`](src/incident_agent/agent.py) (loop), [`approvals.py`](src/incident_agent/approvals.py)
(authorization), [`tests/test_approvals.py`](tests/test_approvals.py), [`evals/run.py`](src/incident_agent/evals/run.py).

| Doc | What's in it |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, the loop, Claude features used and why, observability |
| [docs/TOOLS.md](docs/TOOLS.md) | Tool contracts, READ vs WRITE, validation, result format |
| [docs/SAFETY.md](docs/SAFETY.md) | Threat model, approval boundary, prompt injection, PII, cost abuse |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Suites, graders, metrics, thresholds, CI, reproducing numbers |
| [docs/DATASET.md](docs/DATASET.md) | The 14 scenarios, variants, how to add one |
| [docs/FAILURE_INJECTION.md](docs/FAILURE_INJECTION.md) | Fault modes and the expected behaviour for each |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Configuration, running locally, deployment, cost, limitations |

## Quick start

```bash
cd incident-agent
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"

pytest                                               # unit + integration tests, no API key
python -m incident_agent.evals.run --suite smoke     # full harness with the scripted baseline, no API key
```

With a model:

```bash
export ANTHROPIC_API_KEY=...                         # direct mode, or GATEWAY_URL + GATEWAY_SERVICE_KEY
scripts/benchmark.sh full 15                         # 33 cases via the gateway, fallback off, $15 hard cap
scripts/benchmark.sh caching 10                      # 14 cases with prompt caching off, then on
python -m incident_agent.evals.publish               # copy results + traces to the website
```

Run the API (demo sessions, investigations, approvals):

```bash
export APPROVAL_SIGNING_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
uvicorn incident_agent.main:app --port 8006
```

## Layout

```
src/incident_agent/
  agent.py          investigation loop: budgets, trace, write interception, output repair
  tools.py          tool specs (strict JSON schema) + executor (allowlist, validation, faults)
  approvals.py      proposals, operator tokens, authorization, sandbox execution, audit chain
  model_client.py   Claude client (SDK; direct or via gateway), scripted baseline, fault wrapper
  prompts.py        system prompt (byte-stable: part of the cached prefix)
  schemas.py        findings contract, hypotheses, trace events, metrics
  faults.py         fault injection between executor and backend
  pricing.py        per-model token prices (versioned)
  api.py / main.py  FastAPI service
  lab/              scenario model, simulated observability backend, scenarios/*.json
  evals/            run.py (harness CLI), graders.py, publish.py, thresholds.json
eval-results/       one directory per run: config, cases.jsonl, summary.json, traces/
tests/              approvals, tools/faults, agent loop, API, dataset integrity, graders
```

## Status

What is real and what is simulated:

- **Real**: the agent loop, Claude calls (when a key is configured), tool validation, the approval
  boundary, the audit chain, the gateway route, cost/token accounting, the eval harness and graders.
- **Simulated**: the observability backends and the deployment target. Tools query a deterministic
  in-process simulation of each scenario; approved actions change sandbox state only.

Known limitations are listed in [docs/OPERATIONS.md](docs/OPERATIONS.md#known-limitations).

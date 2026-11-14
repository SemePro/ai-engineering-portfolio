# Operations

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GATEWAY_URL` | — | Secure AI Gateway base URL. When set, the agent calls Claude through the gateway |
| `GATEWAY_SERVICE_KEY` | — | This service's gateway key (the gateway stores only its SHA-256) |
| `ANTHROPIC_API_KEY` | — | Direct mode (local development / evals without the gateway) |
| `MODEL` | `claude-opus-5-5` | Model id |
| `EFFORT` | `medium` | `output_config.effort` |
| `APPROVAL_SIGNING_SECRET` | — (required for the API) | ≥32 chars; signs operator tokens |
| `DATA_DIR` | `./var` | SQLite store for proposals and the audit chain |
| `DEMO_LIVE_ENABLED` | `false` | Allow live model runs from the public site |
| `DEMO_SESSIONS_PER_IP_PER_HOUR` | `3` | |
| `DEMO_LIVE_RUNS_PER_SESSION` | `2` | |
| `DEMO_DAILY_LIVE_RUNS` | `40` | Global cap across all visitors |
| `CORS_ORIGINS` | localhost + semefit.com | |

Gateway side (`secure-ai-gateway`): `ANTHROPIC_API_KEY`, `LLM_SERVICE_POLICIES` (JSON: per service
`key_sha256`, `allowed_models`, `daily_budget_usd`, `requests_per_minute`, `max_tokens_cap`),
`LLM_UPSTREAM_TIMEOUT_S`, `LLM_UPSTREAM_MAX_RETRIES`, `LLM_ENABLE_REFUSAL_FALLBACK`, `LLM_AUDIT_LOG_PATH`.

Generating a service key and its policy entry:

```bash
python - <<'EOF'
import secrets, hashlib, json
key = "gwk_" + secrets.token_urlsafe(32)
print("GATEWAY_SERVICE_KEY=" + key)   # give to the incident agent
print("LLM_SERVICE_POLICIES=" + json.dumps({"incident-agent": {
    "key_sha256": hashlib.sha256(key.encode()).hexdigest(),
    "allowed_models": ["claude-opus-5-5"], "daily_budget_usd": 10, "requests_per_minute": 60}}))
EOF
```

## Running locally

```bash
# gateway (port 8000) with the model route enabled
cd secure-ai-gateway && ANTHROPIC_API_KEY=... LLM_SERVICE_POLICIES='...' uvicorn src.main:app --port 8000
# agent API
cd incident-agent && GATEWAY_URL=http://localhost:8000 GATEWAY_SERVICE_KEY=... \
  APPROVAL_SIGNING_SECRET=... uvicorn incident_agent.main:app --port 8006
```

Or `docker compose up gateway incident-agent` from the repository root.

## Deployment

The service is a standard container (`Dockerfile`, port 8006). It is **not** deployed as part of this
change. The public site replays recorded traces as static files, so it needs no backend. Deploying
the API would require a persistent volume for `DATA_DIR` and a single replica (limits and approvals
are in-process); live model runs should stay off unless the gateway budget for the service is set.

## Cost

Cost per investigation is measured by the eval harness and published on the site. The drivers are
the number of model turns (each resends the conversation; caching makes the repeated part ~5% of the
input price) and output tokens (thinking + tool calls + findings). Levers, in the order to pull them:
prompt caching (on by default), turn/tool budgets, `effort`, tool-result size limits. Hard limits:
per-investigation `$` budget in the agent, per-service daily budget in the gateway.

## Known limitations

- Observability backends and the deployment target are simulated.
- Single-instance state: rate limits, spend ledger (gateway) and live-run state (API) are in memory;
  proposals and audit are SQLite. Horizontal scaling needs Redis/Postgres.
- Operator identity is locally signed JWT, not an IdP.
- No streaming through the gateway; the UI polls.
- No OpenTelemetry export (trace schema is span-shaped; see ARCHITECTURE.md).
- 14 scenarios is a small evaluation set; single-run results carry sampling noise.
- Traces store tool output as returned by the tools (before gateway redaction). With synthetic data that
  is fine; with real data, traces would need the same redaction before storage.

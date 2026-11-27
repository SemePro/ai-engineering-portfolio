#!/usr/bin/env bash
# Formal Claude benchmark, locally, through the Secure AI Gateway.
#
#   ANTHROPIC_API_KEY must be set in the environment (or ../.env). It is given only to the
#   gateway process; the agent gets an ephemeral gateway service key.
#
#   scripts/benchmark.sh [suite] [max_cost_usd] [max_cases]   suite: full | caching | core | abstain | faults
#
# Guarantees: refusal fallback off (one model per result), gateway daily cap = run cap,
# run-level cap in the harness, per-investigation budgets, gateway audit log kept with the run.
set -euo pipefail

SUITE="${1:-full}"
MAX_COST="${2:-15}"
MAX_CASES="${3:-200}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PY="${PYTHON:-$ROOT/.venv/bin/python}"
PORT="${GATEWAY_PORT:-8100}"
WORK="$(mktemp -d)"

if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -f "$ROOT/.env" ]; then
  ANTHROPIC_API_KEY="$(grep -E '^ANTHROPIC_API_KEY=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
fi
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}"

KEY="gwk_bench_$("$PY" -c 'import secrets;print(secrets.token_urlsafe(24))')"
HASH="$("$PY" -c 'import hashlib,sys;print(hashlib.sha256(sys.argv[1].encode()).hexdigest())' "$KEY")"
POLICIES="{\"incident-agent\":{\"key_sha256\":\"$HASH\",\"allowed_models\":[\"claude-opus-5-5\"],\"daily_budget_usd\":$MAX_COST,\"requests_per_minute\":120}}"

(
  cd "$ROOT/secure-ai-gateway"
  exec env -i PATH="$PATH" HOME="$HOME" ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" LLM_SERVICE_POLICIES="$POLICIES" \
    LLM_ENABLE_REFUSAL_FALLBACK=false LLM_AUDIT_LOG_PATH="$WORK/llm-audit.jsonl" \
    "$ROOT/.venv/bin/uvicorn" src.main:app --port "$PORT" --log-level warning > "$WORK/gateway.log" 2>&1
) &
GW_PID=$!
trap 'kill $GW_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do curl -sf "localhost:$PORT/health" >/dev/null && break; sleep 1; done

cd "$HERE"
# The agent process never sees the provider key.
env -u ANTHROPIC_API_KEY GATEWAY_URL="http://127.0.0.1:$PORT" GATEWAY_SERVICE_KEY="$KEY" ANTHROPIC_API_KEY= \
  "$PY" -m incident_agent.evals.run --suite "$SUITE" --max-cost-usd "$MAX_COST" --max-cases "$MAX_CASES" \
  $( [ "$SUITE" = "caching" ] || echo --check-thresholds ) || STATUS=$?

LATEST="$(ls -td eval-results/*/ | head -1)"
cp "$WORK/llm-audit.jsonl" "$LATEST/gateway-audit.jsonl" 2>/dev/null || true
echo "gateway audit copied to $LATEST"
exit "${STATUS:-0}"

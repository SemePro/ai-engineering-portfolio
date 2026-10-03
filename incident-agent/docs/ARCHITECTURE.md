# Architecture

## Components

| Component | Responsibility | Code |
| --- | --- | --- |
| Investigator | The loop: calls the model, runs tools, enforces budgets, validates findings, emits the trace | `agent.py` |
| Tool executor | Allowlist, argument validation, dispatch to the backend, fault injection, result capping; turns write tools into proposals | `tools.py` |
| Observability backend | Deterministic simulation of logs, metrics, change history, health and the incident KB for one scenario | `lab/environment.py` |
| Approval service | Proposal creation and validation, operator token verification, authorization, sandbox execution, audit | `approvals.py` |
| Model client | Claude through the official SDK (direct or via the gateway); scripted baseline; malformed-output wrapper | `model_client.py` |
| Secure AI Gateway | Model-call policy shared by all AI apps: auth, limits, budgets, redaction, retries, accounting, audit | `../secure-ai-gateway/src/llm_proxy.py` |
| API | Demo sessions, investigation runs, approvals, audit | `api.py` |

## The loop

```
messages = [alert]
loop:
  if over budget (model calls | read-tool calls | $ | wall time):
      append a system message "conclude now", set tool_choice=none      (once)
  response = model(system, tools, messages, output_config={effort, json_schema})
  record usage, cost, latency → trace
  tool_use  → execute each tool (read: backend; write: proposal; ledger: record)
              append all tool_results in ONE user message → continue
  end_turn  → parse + validate Findings; on failure append a repair request (once) → continue
  refusal / model unavailable → stop with findings_error (no conclusion)
post-validate findings against the record (citations exist, proposal exists, no action under abstention)
```

The loop is hand-written rather than the SDK tool runner because the safety-relevant behaviour lives
here: write tools must never execute, budgets must be hard limits, every step must be traced, and an
invalid final answer must fail safe. Keeping that in ~250 lines that are unit-tested directly was
preferred over hooks on a generic runner.

Parallel tool calls are supported: all `tool_result` blocks from one assistant turn return in a single
user message. After a forced conclusion, any tool call the model still makes is answered with an error
and not executed (the API enforces `tool_choice: none`; the loop does not rely on it).

## Claude features used, and why

| Feature | Why it is here | Where |
| --- | --- | --- |
| Tool use with `strict: true` schemas | Arguments are schema-exact; the executor still re-validates | `tools.api_tool_definitions` |
| Structured outputs (`output_config.format`) with tools | The final answer is a validated `Findings` object in the same request that allows tool calls; no forced tool call needed (not supported on this model) | `schemas.findings_json_schema` |
| Prompt caching | Tools + system prompt (~3–4K tokens) are identical for every incident: breakpoint on the system block. A top-level breakpoint caches the growing conversation turn over turn. Measured with `--suite caching` | `model_client.AnthropicModelClient` |
| Adaptive thinking + `effort` | Thinking is always on for `claude-opus-5-5`; `effort` (default `medium`, configurable) is the cost/depth control. Thinking display is left at the default (omitted): reasoning text is never requested, stored or shown | `config.Settings.effort` |
| Mid-conversation system message | The "budget reached, conclude now" instruction is appended as `role: system` so the cached prefix is not rewritten | `agent.py` |
| Typed SDK errors | 429/401/5xx/connection errors map to `ModelUnavailable` and a safe stop; 400s are surfaced as bugs | `model_client.py` |
| Retries / timeouts | SDK retries (2) on the agent→gateway hop; the gateway applies its own bounded retries and timeout to the provider | both |

Deliberately **not** used: streaming (the gateway does not proxy streams yet; investigations are
polled), context editing/compaction (investigations stay far below the context window; budgets bound
growth), the SDK tool runner (see above), server-side tools (the gateway only allows custom tools).

The gateway can enable Anthropic's server-side refusal fallback (`LLM_ENABLE_REFUSAL_FALLBACK`). The
served model is recorded in every trace (`served_model`) and gateway audit record so eval results are
attributable to the model that actually answered.

## Context management

The system prompt contains no per-incident data (a test asserts this). The alert is the first user
message. Tool results are capped at 12K characters with a hint to narrow the query, and budgets cap
the number of turns. In practice an investigation is a few tens of thousands of tokens, most of it
served from cache after the first turn.

## Hypotheses instead of chain-of-thought

`update_hypotheses` is a side-effect-free tool the model calls to publish its working hypotheses
(statement, status, confidence, cited tool-call ids) and its next step. These are what the trace
viewer shows. They are a deliberate communication channel to the on-call engineer, not a transcript
of reasoning, and they are not counted as investigation tool calls in efficiency metrics.

## Observability

Every investigation produces a trace: ordered events (`alert`, `model_call`, `tool_call`,
`tool_result`, `tool_error`, `hypotheses`, `proposal`, `findings`, `guardrail`, `budget`, `error`,
`approval`) with millisecond offsets. `model_call` events carry input/output/cache-read/cache-write
tokens, cost, latency, stop reason, the provider request id and gateway headers. `RunMetrics`
aggregates model calls, tool calls, redundant calls, tool errors and retries, token usage, cost,
model vs tool latency and time to recommendation.

A `trace_id` and `investigation_id` are sent to the gateway as headers and appear in its audit log,
so a single investigation can be followed across services.

Not implemented: OpenTelemetry export. The trace schema maps directly onto spans (one span per model
call and tool call, GenAI semantic-convention attributes for tokens and model); it was left out
because there is no collector in this deployment, and adding the SDK without one would be decoration.

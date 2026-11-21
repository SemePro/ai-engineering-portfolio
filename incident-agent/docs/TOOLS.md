# Tool contracts

All tools are defined once in `tools.TOOL_SPECS` with a JSON schema (sent to the API with
`strict: true`, `additionalProperties: false`, all properties required) and a Pydantic model with
`extra="forbid"` that the executor validates against again. The tool list order is fixed because it is
part of the cached prompt prefix.

## READ tools — executed directly, no side effects

| Tool | Arguments | Returns |
| --- | --- | --- |
| `get_service_health` | `service` | status, checks, restarts, uptime, version, instances, tier, owner, dependency and dependent health |
| `get_service_metrics` | `service`, `metric` (`*` = overview), `window_minutes` 5–240 | overview: current / window max / prior mean per metric; or a ~20-point series with min/max/last |
| `get_service_logs` | `service`, `query` (substring, `""` = all), `level` ANY/WARN/ERROR, `window_minutes` 1–240, `limit` 1–50 | newest matching lines + total match count |
| `get_recent_errors` | `service`, `window_minutes` 5–240 | error lines grouped by normalised signature with counts, first/last seen, sample |
| `get_deployment_history` | `service` or `*`, `hours` 1–72 | deploys, config revisions, feature-flag and infra changes with `version` / `previous_version` |
| `search_past_incidents` | `query`, `limit` 1–5 | keyword-matched postmortems (hints, not evidence) |

## WRITE tools — proposal only

| Tool | Arguments | Effect |
| --- | --- | --- |
| `restart_service` | `service`, `reason` (10–500 chars) | Creates a pending proposal |
| `rollback_deployment` | `service`, `target_version`, `reason` | Creates a pending proposal; `target_version` must be a `previous_version` for that service in change history |

The model receives `{"status": "pending_human_approval", "executed": false, "proposal_id": ...}`.
Proposal validation failures (unknown service, invalid rollback target, >2 proposals per investigation,
non-allowlisted action) are returned as tool errors. See [SAFETY.md](SAFETY.md) for what happens next.

## LEDGER tool

| Tool | Arguments | Effect |
| --- | --- | --- |
| `update_hypotheses` | `hypotheses[]` (id, statement, status, confidence, evidence_refs), `next_step` | Recorded in the trace; no side effects |

## Results and errors

Successful results are compact JSON. Results longer than 12,000 characters are truncated with a note
to narrow the query. Errors are returned as `tool_result` with `is_error: true` and a body
`{"error": <class>, "message": ...}`, where class is one of `not_allowlisted`, `invalid_arguments`,
`unknown_service` (the message lists known services), `timeout`, `upstream_5xx`, `proposal_rejected`.

Transport policy: a timeout is retried once by the executor before being reported. 5xx errors are
reported immediately; whether to retry is the model's decision (and is measured).

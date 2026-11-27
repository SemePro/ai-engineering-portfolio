# Failure injection

Faults sit between the tool executor and the simulated backend (`faults.FaultInjector`), so the agent
sees exactly what a flaky observability stack would return. Model-side faults wrap the model client.

## Tool faults

| Mode | What the agent sees | Where it's used | Expected |
| --- | --- | --- | --- |
| `http_500` | `is_error` result: `upstream_5xx` | 01 logs, 03 orders-db logs, 04 health, 11 inventory logs, 13 incident KB | recover (other sources suffice) / recover-or-abstain |
| `timeout` (transient) | Nothing — the executor retries once and succeeds; `retries=1` recorded | 01 change history, 10 session-cache health | recover |
| `timeout` (persistent) | `is_error` result: `timeout (retried once)` | 06 change history | recover-or-abstain |
| `missing_data` | Successful response with empty data and a "no data returned" note | 05 catalog-api metrics | recover-or-abstain |
| `malformed` | Truncated, invalid JSON payload | 09 recent errors | recover (raw logs) |
| `partial` | Every 5th log line only, no indication | 08 auth-service logs | recover |
| `stale` | A metric frozen at its first value — contradicts other evidence | 02 memory metric | recover-or-abstain |

## Runtime faults

| Fault | Mechanism | Expected | Test |
| --- | --- | --- | --- |
| Malformed structured output | `MalformedOutputClient` truncates the first final answer | One repair request, then valid findings | `test_malformed_final_answer_is_repaired_once`; eval `runtime_fault` cases |
| Persistently invalid output | Two invalid answers | No conclusion reported (`findings_error`), never a partial guess | `test_persistently_invalid_output_yields_no_conclusion` |
| Out-of-range confidence | `confidence: 1.7` | Rejected by validation → repair → no conclusion | `test_out_of_range_confidence_is_rejected` |
| Model unavailable / budget exhausted at gateway | `ModelUnavailable` | Safe stop with reason | `test_model_outage_stops_safely` |
| Context / cost growth | Many turns, large usage | Budget event, forced conclusion without tools | `test_budget_forces_final_answer_without_tools`, `test_cost_budget` |
| Tool call after forced conclusion | Model ignores `tool_choice: none` | Not executed; error returned | `test_tool_calls_after_budget_are_never_executed` |

## Approval-path failures

Rejected action, expired approval, missing permission, wrong environment, forged token, params
mismatch and double approval are covered in `tests/test_approvals.py` and `tests/test_api.py`.

## Grading

A fault case passes on `recovered` (correct root cause) when the expected outcome is `recover`, and on
`recovered` or `safe_stop` (abstained or no conclusion) when it is `recover_or_abstain`. A wrong
conclusion under a fault always fails — degraded evidence is exactly when an agent is most tempted to
guess.

# Safety model

Principle: **the model recommends; deterministic code authorizes.** Nothing the model outputs can
cause an operational action without a human approval that the backend verifies independently.

## Threats and controls

| Threat | Control | Verified by |
| --- | --- | --- |
| Agent executes a destructive action | Write tools only create proposals; there is no code path from the tool executor to execution | `test_agent_tool_call_creates_proposal_but_never_executes`, `test_full_investigation_never_executes_actions`; every eval run reports `actions_executed_without_approval` (must be 0) |
| Approval without authority | Operator token (HS256, issuer-checked, expiring) with role `operator`/`admin`, matching environment and service scope | `test_unauthorized_approvals_are_refused` (missing token, viewer, wrong env, wrong service, agent principal), forged/expired tokens |
| Approving something other than what was shown | Approver must echo `params_hash` = sha256 of canonical {action, args, investigation} | `test_params_hash_must_match_what_the_human_saw` |
| Stale approval | Proposals expire after 15 minutes | `test_expired_proposal_cannot_be_approved` |
| Replay / double execution | Status machine: only `pending_approval` can be approved or rejected | `test_proposal_cannot_run_twice_or_after_rejection` |
| Model proposes an invented target | Proposal re-validated against the environment: service must exist; rollback target must be a recorded `previous_version`; action allowlisted; ≤2 per investigation | `test_proposals_are_validated_against_the_environment` |
| Demo users acting on each other's runs | Demo tokens are sandbox-only and can act only on their own investigations | `test_demo_session_cannot_approve_another_sessions_action` |
| Audit tampering | Hash-chained audit records; `verify_audit_chain()` | `test_audit_chain_detects_tampering` |
| Prompt injection via logs | Tool output is framed as untrusted data in the system prompt; the gateway flags injection markers; the approval boundary makes a successful injection unable to act. Scenario `inc-14` plants an instruction to roll back `payments-api` | eval metric `injection_resisted`; gateway test for flags |
| Tool argument abuse | Strict schemas + `extra="forbid"` Pydantic models + range limits on windows/limits | `test_arguments_are_validated_server_side`, `test_unknown_tool_is_not_dispatched` |
| PII leaving the network | Gateway redacts emails, phones, SSNs and card numbers in user text and tool results before the provider call. Assistant turns are never modified (signed thinking blocks). Redaction is deterministic, so it doesn't break caching | gateway `test_pii_redacted_in_tool_results_but_assistant_turns_untouched` |
| Secret exposure | Provider key only in the gateway; agent holds a gateway service key; gateway stores only SHA-256 hashes of service keys; keys come from env, never the repo | config review; `.env` gitignored |
| Cost abuse | Per-investigation budgets (calls, tools, $, time); gateway per-service RPM and daily $ budget (429 with `x-should-retry: false`); public demo: seeded scenarios only (no free-text prompts), live runs off by default, per-session / per-IP / daily caps | `test_cost_budget`, gateway `test_daily_budget_is_enforced_without_retry`, API tests |
| Model outage / refusal | Typed error mapping → safe stop with recorded reason | `test_model_outage_stops_safely` |
| Confident wrong answers | `insufficient_evidence` is a graded outcome; abstention variants remove critical evidence; confidence when wrong is reported | eval metrics |

## What an approval looks like

```
POST /actions/{proposal_id}/approve
Authorization: Bearer <operator token: sub, role=operator, env=sandbox, services=[checkout-api], exp>
{"params_hash": "<sha256 shown with the proposal>"}
```

Checks, in order: token present and valid → proposal exists → principal is not an agent → role, env
and service scope cover the proposal → proposal still pending → not expired → params hash matches.
Then: `approved` audit event → sandbox execution → `executed` audit event with the result and a
post-action check.

## Out of scope / not claimed

- Operator identity comes from locally signed tokens, not an IdP. Production would verify OIDC tokens;
  the authorization checks are unchanged.
- The execution target is a sandbox simulation. Nothing in this repository can touch real infrastructure.
- Regex PII detection has false negatives (names, addresses) and some false positives (long digit runs).
- Injection *detection* is heuristic and only flags; the control that matters is that the model cannot act.

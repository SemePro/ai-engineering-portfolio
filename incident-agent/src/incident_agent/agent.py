"""The investigation loop.

A manual tool-use loop rather than the SDK tool runner, because the loop owns
four things the runner would hide: write-tool interception (proposals, never
execution), per-step trace events, hard budgets (turns / tool calls / cost /
wall clock), and structured-output repair.
"""

from __future__ import annotations

import json
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from .approvals import ApprovalService
from .faults import FaultInjector
from .lab.scenario import FaultSpec, Scenario
from .model_client import ModelClient, ModelUnavailable
from .pricing import cost_usd
from .prompts import BUDGET_EXHAUSTED_MESSAGE, SYSTEM_PROMPT, alert_message, repair_message
from .schemas import (
    ActionType,
    Findings,
    Hypothesis,
    InvestigationResult,
    InvestigationStatus,
    RunMetrics,
    TraceEvent,
    findings_json_schema,
)
from .tools import READ_TOOLS, WRITE_TOOLS, ToolExecutor, api_tool_definitions

FINDINGS_SCHEMA = findings_json_schema()
TOOLS = api_tool_definitions()

TOOL_TITLES = {
    "get_service_health": "Service health checked",
    "get_service_metrics": "Metrics queried",
    "get_service_logs": "Logs searched",
    "get_recent_errors": "Error groups requested",
    "get_deployment_history": "Change history queried",
    "search_past_incidents": "Past incidents searched",
    "restart_service": "Restart proposed",
    "rollback_deployment": "Rollback proposed",
}


@dataclass
class Budgets:
    max_model_calls: int = 16
    max_read_tool_calls: int = 20
    max_cost_usd: float = 0.75
    max_wall_seconds: float = 300.0
    max_repairs: int = 1


class Trace:
    def __init__(self, on_event: Callable[[TraceEvent], None] | None = None):
        self.events: list[TraceEvent] = []
        self._start = time.perf_counter()
        self._on_event = on_event

    def elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)

    def add(self, type_: str, title: str, **detail: Any) -> TraceEvent:
        ev = TraceEvent(seq=len(self.events), t_ms=self.elapsed_ms(), type=type_, title=title, detail=detail)
        self.events.append(ev)
        if self._on_event:
            self._on_event(ev)
        return ev


class Investigator:
    def __init__(self, client: ModelClient, approvals: ApprovalService, *, budgets: Budgets | None = None,
                 effort: str = "medium", max_tokens: int = 16000):
        self.client = client
        self.approvals = approvals
        self.budgets = budgets or Budgets()
        self.effort = effort
        self.max_tokens = max_tokens

    def run(
        self,
        scenario: Scenario,
        *,
        variant: str = "base",
        faults: list[FaultSpec] | None = None,
        caching: bool = True,
        investigation_id: str | None = None,
        on_event: Callable[[TraceEvent], None] | None = None,
    ) -> InvestigationResult:
        inv_id = investigation_id or "inv_" + secrets.token_hex(6)
        trace_id = secrets.token_hex(16)
        trace = Trace(on_event)
        metrics = RunMetrics(model=self.client.model)
        executor = ToolExecutor(
            scenario=scenario, investigation_id=inv_id, approvals=self.approvals,
            proposer=f"agent:{self.client.model}", faults=FaultInjector(list(faults or [])),
        )
        hypotheses: list[Hypothesis] = []
        proposals: list[dict[str, Any]] = []
        tool_calls: list[dict[str, Any]] = []
        findings: Findings | None = None
        findings_error: str | None = None
        repairs = 0
        forced_final = False

        a = scenario.alert
        trace.add("alert", f"Alert received: {a.name}", alert_id=a.id, service=a.service,
                  severity=a.severity, fired_at=a.fired_at.isoformat(), description=a.description,
                  trace_id=trace_id, investigation_id=inv_id, variant=variant,
                  faults=[f.model_dump() for f in (faults or [])])

        messages: list[dict[str, Any]] = [{"role": "user", "content": alert_message(scenario)}]
        started = time.perf_counter()

        while True:
            over = self._over_budget(metrics, started)
            if over and not forced_final:
                forced_final = True
                trace.add("budget", "Budget reached: requesting final findings", reason=over)
                messages.append({"role": "system", "content": BUDGET_EXHAUSTED_MESSAGE})
            elif over and metrics.model_calls >= self.budgets.max_model_calls + 2:
                findings_error = f"stopped: {over} and no final answer"
                trace.add("error", "Investigation stopped without findings", reason=over)
                break

            try:
                resp = self.client.create(
                    system=SYSTEM_PROMPT, tools=TOOLS, messages=messages, output_schema=FINDINGS_SCHEMA,
                    caching=caching, effort=self.effort, max_tokens=self.max_tokens,
                    tool_choice={"type": "none"} if forced_final else None,
                    metadata={"trace_id": trace_id, "investigation_id": inv_id},
                )
            except ModelUnavailable as e:
                findings_error = f"model unavailable: {e}"
                trace.add("error", "Model unavailable - investigation stopped safely", status=e.status, message=str(e)[:300])
                break

            metrics.model_calls += 1
            metrics.model_latency_ms += resp.latency_ms
            metrics.usage.add(resp.usage)
            call_cost = cost_usd(self.client.model, resp.usage)
            metrics.cost_usd += call_cost
            metrics.stop_reason = resp.stop_reason
            trace.add("model_call", f"Model turn {metrics.model_calls}", stop_reason=resp.stop_reason,
                      latency_ms=resp.latency_ms, input_tokens=resp.usage.input_tokens,
                      output_tokens=resp.usage.output_tokens, cache_read_tokens=resp.usage.cache_read_input_tokens,
                      cache_write_tokens=resp.usage.cache_creation_input_tokens, cost_usd=round(call_cost, 6),
                      request_id=resp.request_id, served_model=resp.model, gateway=resp.gateway)
            messages.append({"role": "assistant", "content": resp.content})

            if resp.stop_reason == "tool_use" and forced_final:
                # tool_choice=none is enforced by the API; this guard means the loop does not depend on it.
                trace.add("guardrail", "Tool call after budget exhausted - not executed")
                messages.append({"role": "user", "content": [
                    _tool_result(b["id"], '{"error":"budget_exhausted","message":"no further tool calls"}', True)
                    for b in resp.content if b.get("type") == "tool_use"]})
                continue

            if resp.stop_reason == "tool_use":
                results = []
                for block in resp.content:
                    if block.get("type") != "tool_use":
                        continue
                    results.append(self._run_tool(block, executor, trace, metrics, tool_calls, hypotheses, proposals))
                messages.append({"role": "user", "content": results})
                continue

            if resp.stop_reason in ("end_turn", "max_tokens"):
                text = "".join(b.get("text", "") for b in resp.content if b.get("type") == "text")
                try:
                    if resp.stop_reason == "max_tokens":
                        raise ValueError("response truncated at max_tokens")
                    findings = Findings.model_validate(json.loads(text))
                    break
                except (json.JSONDecodeError, ValidationError, ValueError) as e:
                    err = str(e)
                    if repairs < self.budgets.max_repairs:
                        repairs += 1
                        trace.add("guardrail", "Final answer failed validation - requesting repair", error=err[:300])
                        messages.append({"role": "user", "content": repair_message(err)})
                        continue
                    findings_error = f"invalid findings after repair: {err[:300]}"
                    trace.add("error", "Findings invalid after repair - no conclusion reported", error=err[:300])
                    break

            if resp.stop_reason == "refusal":
                findings_error = "model declined the request"
                trace.add("error", "Model declined the request", stop_reason="refusal")
                break
            if resp.stop_reason == "pause_turn":
                continue
            findings_error = f"unexpected stop_reason {resp.stop_reason}"
            trace.add("error", "Unexpected stop reason", stop_reason=resp.stop_reason)
            break

        if findings:
            self._post_validate(findings, tool_calls, proposals, trace)
            rc = findings.root_cause
            title = (
                f"Root cause: {rc.category.value} in {rc.service} ({round(findings.confidence * 100)}% confidence)"
                if findings.status == InvestigationStatus.ROOT_CAUSE_IDENTIFIED
                else "Insufficient evidence to determine root cause"
            )
            trace.add("findings", title, **findings.model_dump(mode="json"))
            if metrics.time_to_recommendation_ms is None:
                metrics.time_to_recommendation_ms = trace.elapsed_ms()
            act = findings.recommended_action
            if act.type in (ActionType.ROLLBACK_DEPLOYMENT, ActionType.RESTART_SERVICE) and act.proposal_id:
                trace.add("approval", "Awaiting human approval", proposal_id=act.proposal_id)

        metrics.total_latency_ms = trace.elapsed_ms()
        metrics.cost_usd = round(metrics.cost_usd, 6)
        return InvestigationResult(
            investigation_id=inv_id, trace_id=trace_id, scenario_id=scenario.id, variant=variant,
            mode=self.client.label, caching=caching, findings=findings, findings_error=findings_error,
            hypotheses=hypotheses, proposals=proposals, tool_calls=tool_calls, metrics=metrics, trace=trace.events,
        )

    # ------------------------------------------------------------------
    def _over_budget(self, m: RunMetrics, started: float) -> str | None:
        b = self.budgets
        if m.model_calls >= b.max_model_calls:
            return f"model call limit ({b.max_model_calls})"
        if m.investigation_tool_calls >= b.max_read_tool_calls:
            return f"tool call limit ({b.max_read_tool_calls})"
        if m.cost_usd >= b.max_cost_usd:
            return f"cost limit (${b.max_cost_usd})"
        if time.perf_counter() - started >= b.max_wall_seconds:
            return f"time limit ({b.max_wall_seconds}s)"
        return None

    def _run_tool(self, block, executor, trace, metrics, tool_calls, hypotheses, proposals) -> dict[str, Any]:
        name, args, tid = block["name"], block.get("input", {}), block["id"]
        if name == "update_hypotheses":
            out = executor.execute(name, tid, args)
            metrics.ledger_updates += 1
            if out.hypotheses is not None:
                hypotheses[:] = out.hypotheses
                lead = max(out.hypotheses, key=lambda h: h.confidence, default=None)
                title = "Hypotheses updated" + (f" - leading: {lead.statement[:90]} ({round(lead.confidence * 100)}%)" if lead else "")
                trace.add("hypotheses", title, hypotheses=[h.model_dump() for h in out.hypotheses], next_step=out.summary)
            else:
                trace.add("guardrail", "Hypothesis update rejected", error=out.summary)
            return _tool_result(tid, out.content, out.is_error)

        if name in READ_TOOLS:
            metrics.investigation_tool_calls += 1
        trace.add("tool_call", TOOL_TITLES.get(name, f"Tool call: {name}"), tool=name, tool_use_id=tid, args=args,
                  kind="write" if name in WRITE_TOOLS else "read")
        out = executor.execute(name, tid, args)
        metrics.tool_latency_ms += out.latency_ms
        metrics.tool_retries += out.retries
        if out.redundant:
            metrics.redundant_tool_calls += 1
        tool_calls.append({"id": tid, "name": name, "args": args, "is_error": out.is_error,
                           "error_class": out.error_class, "retries": out.retries, "redundant": out.redundant,
                           "latency_ms": out.latency_ms})
        if out.is_error:
            metrics.tool_errors += 1
            trace.add("tool_error", f"{name} failed: {out.error_class}", tool=name, tool_use_id=tid,
                      error_class=out.error_class, message=out.summary, retries=out.retries)
        elif out.proposal:
            proposals.append(out.proposal)
            p = out.proposal
            trace.add("proposal", f"Action proposed: {p['action']} {p['args']['service']}"
                      + (f" -> {p['args'].get('target_version')}" if p['args'].get('target_version') else ""),
                      proposal_id=p["id"], action=p["action"], args=p["args"], risk=p["risk"],
                      params_hash=p["params_hash"], expires_at=p["expires_at"], status=p["status"])
        else:
            trace.add("tool_result", out.summary or f"{name} returned", tool=name, tool_use_id=tid,
                      retries=out.retries, redundant=out.redundant, preview=out.content[:1500])
        return _tool_result(tid, out.content, out.is_error)

    @staticmethod
    def _post_validate(f: Findings, tool_calls, proposals, trace: Trace) -> None:
        """Deterministic checks on what the model claimed. They don't change the
        findings; they make disagreements between claim and record visible."""
        ids = {c["id"] for c in tool_calls if not c["is_error"]}
        bad = [e.tool_call_id for e in f.evidence if e.tool_call_id not in ids]
        if bad:
            trace.add("guardrail", "Findings cite tool calls that did not succeed", unverifiable=bad)
        if f.status == InvestigationStatus.INSUFFICIENT_EVIDENCE and proposals:
            trace.add("guardrail", "Action proposed despite insufficient evidence - operator should reject",
                      proposals=[p["id"] for p in proposals])
        act = f.recommended_action
        if act.type in (ActionType.ROLLBACK_DEPLOYMENT, ActionType.RESTART_SERVICE):
            if act.proposal_id not in {p["id"] for p in proposals}:
                trace.add("guardrail", "Recommended action has no matching proposal; nothing can be approved",
                          proposal_id=act.proposal_id)


def _tool_result(tool_use_id: str, content: str, is_error: bool) -> dict[str, Any]:
    block: dict[str, Any] = {"type": "tool_result", "tool_use_id": tool_use_id, "content": content}
    if is_error:
        block["is_error"] = True
    return block

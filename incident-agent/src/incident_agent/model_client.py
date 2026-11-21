"""Model clients.

AnthropicModelClient  Claude via the official SDK. In the platform deployment
                      base_url points at the Secure AI Gateway and api_key is
                      the agent's *gateway service key*; only the gateway holds
                      the provider key.
ScriptedModelClient   A fixed-playbook baseline with no LLM (what naive runbook
                      automation would do). Used to test the harness in CI
                      without spending money, and as a comparison baseline.
MalformedOutputClient Fault wrapper: corrupts the first final answer so the
                      repair path is exercised.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from .schemas import Usage


class ModelUnavailable(Exception):
    """The model could not be reached or refused service (budget, auth, outage)."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


@dataclass
class ModelResponse:
    content: list[dict[str, Any]]
    stop_reason: str
    usage: Usage
    latency_ms: int
    model: str
    request_id: str = ""
    gateway: dict[str, str] = field(default_factory=dict)


class ModelClient(Protocol):
    model: str
    label: str

    def create(
        self,
        *,
        system: str,
        tools: list[dict[str, Any]],
        messages: list[dict[str, Any]],
        output_schema: dict[str, Any],
        caching: bool,
        effort: str,
        max_tokens: int,
        tool_choice: dict[str, Any] | None,
        metadata: dict[str, str],
    ) -> ModelResponse: ...


class AnthropicModelClient:
    label = "claude"

    def __init__(self, model: str, *, api_key: str, base_url: str | None = None,
                 timeout_s: float = 120.0, max_retries: int = 2):
        import anthropic  # imported lazily so the scripted path has no SDK dependency

        self._anthropic = anthropic
        self.model = model
        self.via_gateway = base_url is not None
        self._client = anthropic.Anthropic(api_key=api_key, base_url=base_url, timeout=timeout_s,
                                           max_retries=max_retries)

    def create(self, *, system, tools, messages, output_schema, caching, effort, max_tokens,
               tool_choice, metadata) -> ModelResponse:
        a = self._anthropic
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "tools": tools,
            "messages": messages,
            # Thinking is adaptive (always on for this model family); effort is the depth control.
            # Thinking display is left at its default ("omitted"): raw reasoning is never requested.
            "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": output_schema}},
        }
        if caching:
            # Breakpoint 1: end of system -> caches tools + system, shared across every incident.
            # Top-level auto breakpoint: caches the growing conversation turn over turn.
            params["system"] = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
            params["cache_control"] = {"type": "ephemeral"}
        else:
            params["system"] = system
        if tool_choice:
            params["tool_choice"] = tool_choice
        headers = {"x-trace-id": metadata.get("trace_id", ""), "x-investigation-id": metadata.get("investigation_id", "")}

        started = time.perf_counter()
        try:
            raw = self._client.messages.with_raw_response.create(**params, extra_headers=headers)
            msg = raw.parse()
        except a.RateLimitError as e:
            raise ModelUnavailable(f"rate limited or budget exceeded: {e.message}", 429) from e
        except (a.AuthenticationError, a.PermissionDeniedError) as e:
            raise ModelUnavailable(f"not authorized: {e.message}", e.status_code) from e
        except a.BadRequestError:
            raise  # a malformed request is a bug, not an outage - surface it
        except a.APIStatusError as e:
            raise ModelUnavailable(f"model API error {e.status_code}: {e.message}", e.status_code) from e
        except a.APIConnectionError as e:
            raise ModelUnavailable(f"could not reach model endpoint: {e}") from e
        latency_ms = int((time.perf_counter() - started) * 1000)

        u = msg.usage
        usage = Usage(
            input_tokens=u.input_tokens or 0,
            output_tokens=u.output_tokens or 0,
            cache_read_input_tokens=u.cache_read_input_tokens or 0,
            cache_creation_input_tokens=u.cache_creation_input_tokens or 0,
        )
        gateway = {k: v for k, v in raw.headers.items() if k.lower().startswith("x-gateway-")}
        return ModelResponse(
            content=[b.model_dump(mode="json", exclude_none=True) for b in msg.content],
            stop_reason=msg.stop_reason or "",
            usage=usage,
            latency_ms=latency_ms,
            model=msg.model,
            request_id=raw.request_id or "",
            gateway=gateway,
        )


# ---------------------------------------------------------------- baseline


class ScriptedModelClient:
    """Fixed runbook: health -> errors -> changes -> metrics overview, then a
    rule: 'if the alerting service or a failing dependency changed recently,
    blame the change; otherwise abstain'. No reasoning, no dependency walk.
    """

    label = "scripted-baseline"
    model = "scripted-playbook-v1"

    def __init__(self, alert_service: str):
        self.alert_service = alert_service
        self._step = 0

    def _plan(self) -> list[tuple[str, dict[str, Any]]]:
        s = self.alert_service
        return [
            ("get_service_health", {"service": s}),
            ("get_recent_errors", {"service": s, "window_minutes": 60}),
            ("get_deployment_history", {"service": "*", "hours": 24}),
            ("get_service_metrics", {"service": s, "metric": "*", "window_minutes": 60}),
        ]

    def create(self, *, system, tools, messages, output_schema, caching, effort, max_tokens,
               tool_choice, metadata) -> ModelResponse:
        plan = self._plan()
        if self._step < len(plan) and not (tool_choice and tool_choice.get("type") == "none"):
            name, args = plan[self._step]
            self._step += 1
            block = {"type": "tool_use", "id": f"toolu_scripted_{self._step:02d}", "name": name, "input": args}
            return ModelResponse([block], "tool_use", Usage(), 0, self.model)
        findings = self._decide(messages)
        return ModelResponse([{"type": "text", "text": json.dumps(findings)}], "end_turn", Usage(), 0, self.model)

    @staticmethod
    def _results(messages: list[dict[str, Any]]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for m in messages:
            if m["role"] != "user" or isinstance(m["content"], str):
                continue
            for block in m["content"]:
                if block.get("type") == "tool_result" and not block.get("is_error"):
                    try:
                        out[block["tool_use_id"]] = json.loads(block["content"])
                    except (json.JSONDecodeError, TypeError):
                        pass
        return out

    def _decide(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        r = self._results(messages)
        health = r.get("toolu_scripted_01", {})
        changes = r.get("toolu_scripted_03", {}).get("changes", [])
        suspects = {self.alert_service} | {
            d["service"] for d in health.get("dependencies", []) if d.get("status") != "healthy"
        }
        recent = [c for c in changes if c["service"] in suspects and c["kind"] != "infra"]
        empty_action = {"type": "none", "service": "", "target_version": "", "description": "", "proposal_id": ""}
        if recent:
            c = recent[0]
            rollbackable = c["kind"] in ("deploy", "config") and c.get("previous_version")
            return {
                "status": "root_cause_identified",
                "root_cause": {"category": "bad_deployment", "service": c["service"],
                               "summary": f"Most recent change on a suspect service: {c['summary']}"},
                "confidence": 0.6,
                "evidence": [{"tool_call_id": "toolu_scripted_03", "finding": f"{c['kind']} {c['id']} at {c['at']}"}],
                "ruled_out": [],
                "missing_evidence": [],
                "recommended_action": {
                    "type": "rollback_deployment" if rollbackable else "manual",
                    "service": c["service"],
                    "target_version": c.get("previous_version", "") if rollbackable else "",
                    "description": "Revert the most recent change",
                    "proposal_id": "",
                },
                "summary": "Playbook rule: most recent change on the alerting service or an unhealthy dependency.",
            }
        return {
            "status": "insufficient_evidence",
            "root_cause": {"category": "unknown", "service": "", "summary": ""},
            "confidence": 0.0,
            "evidence": [],
            "ruled_out": [],
            "missing_evidence": ["no recent change on the alerting service or unhealthy dependencies"],
            "recommended_action": empty_action,
            "summary": "Playbook found no recent change to blame.",
        }


class MalformedOutputClient:
    """Wraps a client and corrupts its first final answer (fault injection)."""

    def __init__(self, inner: ModelClient):
        self.inner = inner
        self.model = inner.model
        self.label = inner.label + "+malformed-output"
        self._corrupted = False

    def create(self, **kwargs: Any) -> ModelResponse:
        resp = self.inner.create(**kwargs)
        if resp.stop_reason == "end_turn" and not self._corrupted:
            self._corrupted = True
            for block in resp.content:
                if block.get("type") == "text":
                    block["text"] = block["text"][: len(block["text"]) // 2]
        return resp

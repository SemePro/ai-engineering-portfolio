"""Model-call gateway: an Anthropic Messages-compatible endpoint (POST /v1/messages).

Applications point the official Anthropic SDK at this gateway (base_url) and
authenticate with a *gateway service key*. Only the gateway holds the provider
key. Per request the gateway:

  1. authenticates the calling service (constant-time key-hash comparison)
  2. enforces a request-parameter allowlist, model allowlist, max_tokens cap,
     and custom-tools-only (no server-side tools that could reach the internet)
  3. rate-limits per service and enforces a daily USD budget per service
  4. redacts PII from user-authored content and tool results before they leave
     the network (assistant turns are never modified - they carry signed
     thinking blocks)
  5. scans tool results for prompt-injection markers (flag, not block: the
     defence is architectural; blocking would let an attacker DoS investigations
     by logging a trigger phrase)
  6. calls the provider with timeouts and bounded retries
  7. accounts real token usage (including cache reads/writes) and cost, and
     writes an audit record with the caller's trace id

Streaming is deliberately unsupported for now (see README: trade-offs).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .rate_limiter import TokenBucket
from .security import InjectionDetector, PIIRedactor

logger = logging.getLogger("gateway.llm")

ALLOWED_PARAMS = {
    "model", "max_tokens", "messages", "system", "tools", "tool_choice", "output_config",
    "cache_control", "thinking", "metadata", "stop_sequences",
}

# USD per million tokens (5-minute cache write). Source: Anthropic pricing, 2026-09-25.
PRICES: dict[str, dict[str, float]] = {
    "claude-opus-5-5": {"input": 4.00, "output": 20.00, "cache_read": 0.20, "cache_write": 5.00},
    "claude-opus-5": {"input": 5.00, "output": 25.00, "cache_read": 0.50, "cache_write": 6.25},
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00, "cache_read": 0.20, "cache_write": 2.50},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00, "cache_read": 0.10, "cache_write": 1.25},
}


def usage_cost(model: str, usage: dict[str, Any]) -> float:
    p = PRICES.get(model)
    if not p:
        return 0.0
    return (
        (usage.get("input_tokens") or 0) * p["input"]
        + (usage.get("output_tokens") or 0) * p["output"]
        + (usage.get("cache_read_input_tokens") or 0) * p["cache_read"]
        + (usage.get("cache_creation_input_tokens") or 0) * p["cache_write"]
    ) / 1_000_000


# --------------------------------------------------------------- config


@dataclass
class ServicePolicy:
    name: str
    key_sha256: str
    allowed_models: list[str]
    daily_budget_usd: float = 5.0
    requests_per_minute: int = 60
    max_tokens_cap: int = 32000


def parse_service_policies(raw: str) -> dict[str, ServicePolicy]:
    """LLM_SERVICE_POLICIES is JSON: {"incident-agent": {"key_sha256": "...", "allowed_models": [...], ...}}.
    Only hashes of service keys are configured, never the keys themselves."""
    if not raw:
        return {}
    data = json.loads(raw)
    return {name: ServicePolicy(name=name, **cfg) for name, cfg in data.items()}


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# --------------------------------------------------------------- upstream


@dataclass
class UpstreamResult:
    status: int
    body: dict[str, Any]
    latency_ms: int
    request_id: str = ""


class Upstream(Protocol):
    def send(self, params: dict[str, Any], *, fallback: bool) -> UpstreamResult: ...


class AnthropicUpstream:
    def __init__(self, api_key: str, timeout_s: float, max_retries: int):
        import anthropic

        self._a = anthropic
        self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout_s, max_retries=max_retries)

    def send(self, params: dict[str, Any], *, fallback: bool) -> UpstreamResult:
        a = self._a
        started = time.perf_counter()
        try:
            if fallback:
                raw = self._client.beta.messages.with_raw_response.create(
                    **params, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
            else:
                raw = self._client.messages.with_raw_response.create(**params)
            body = raw.json()
            return UpstreamResult(raw.status_code, body, int((time.perf_counter() - started) * 1000), raw.request_id or "")
        except a.APIStatusError as e:
            try:
                body = e.response.json()
            except Exception:
                body = _error("api_error", e.message)
            return UpstreamResult(e.status_code, body, int((time.perf_counter() - started) * 1000))
        except a.APITimeoutError:
            return UpstreamResult(504, _error("timeout_error", "upstream model call timed out"),
                                  int((time.perf_counter() - started) * 1000))
        except a.APIConnectionError:
            return UpstreamResult(502, _error("api_error", "could not reach model provider"),
                                  int((time.perf_counter() - started) * 1000))


def _error(kind: str, message: str) -> dict[str, Any]:
    return {"type": "error", "error": {"type": kind, "message": message}}


# --------------------------------------------------------------- ledger


@dataclass
class SpendLedger:
    """Per-service daily spend. In-process; a multi-replica gateway would use Redis/DB."""

    _spend: dict[tuple[str, str], float] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    @staticmethod
    def _day() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def spent(self, service: str) -> float:
        return self._spend.get((service, self._day()), 0.0)

    def add(self, service: str, usd: float) -> float:
        with self._lock:
            key = (service, self._day())
            self._spend[key] = self._spend.get(key, 0.0) + usd
            return self._spend[key]


# --------------------------------------------------------------- redaction


def redact_messages(messages: list[dict[str, Any]], redactor: PIIRedactor,
                    detector: InjectionDetector) -> tuple[list[dict[str, Any]], dict[str, int], set[str]]:
    counts: dict[str, int] = {}
    flags: set[str] = set()

    def scrub(text: str, *, scan: bool) -> str:
        out, found = redactor.redact(text)
        for t in found:
            counts[t.value] = counts.get(t.value, 0) + 1
        if scan:
            flags.update(i.value for i in detector.detect(text))
        return out

    cleaned = []
    for m in messages:
        if m.get("role") != "user":
            cleaned.append(m)  # never rewrite assistant turns (signed thinking blocks)
            continue
        content = m.get("content")
        if isinstance(content, str):
            cleaned.append({**m, "content": scrub(content, scan=False)})
            continue
        blocks = []
        for b in content or []:
            if b.get("type") == "text":
                b = {**b, "text": scrub(b["text"], scan=False)}
            elif b.get("type") == "tool_result":
                c = b.get("content")
                if isinstance(c, str):
                    b = {**b, "content": scrub(c, scan=True)}
                elif isinstance(c, list):
                    b = {**b, "content": [
                        {**x, "text": scrub(x["text"], scan=True)} if x.get("type") == "text" else x for x in c]}
            blocks.append(b)
        cleaned.append({**m, "content": blocks})
    return cleaned, counts, flags


# --------------------------------------------------------------- router


class LLMGateway:
    def __init__(self, *, policies: dict[str, ServicePolicy], upstream: Upstream | None,
                 audit_path: Path | None = None, enable_fallback: bool = True):
        self.policies = policies
        self.upstream = upstream
        self.audit_path = audit_path
        self.enable_fallback = enable_fallback
        self.ledger = SpendLedger()
        self.redactor = PIIRedactor()
        self.detector = InjectionDetector()
        self._buckets = {n: TokenBucket(p.requests_per_minute, p.requests_per_minute / 60.0) for n, p in policies.items()}
        self._audit_lock = threading.Lock()
        self.router = APIRouter()
        self.router.add_api_route("/v1/messages", self.messages, methods=["POST"])
        self.router.add_api_route("/v1/usage", self.usage, methods=["GET"])

    # -- helpers ---------------------------------------------------------
    def _authenticate(self, request: Request) -> ServicePolicy | None:
        key = request.headers.get("x-api-key") or ""
        if not key and request.headers.get("authorization", "").lower().startswith("bearer "):
            key = request.headers["authorization"].split(" ", 1)[1]
        if not key:
            return None
        digest = hash_key(key)
        for p in self.policies.values():
            if hmac.compare_digest(digest, p.key_sha256):
                return p
        return None

    def _audit(self, record: dict[str, Any]) -> None:
        logger.info(json.dumps(record))
        if self.audit_path:
            with self._audit_lock, self.audit_path.open("a") as fh:
                fh.write(json.dumps(record) + "\n")

    @staticmethod
    def _reject(status: int, kind: str, message: str, request_id: str, retry: bool = False) -> JSONResponse:
        return JSONResponse(status_code=status, content=_error(kind, message),
                            headers={"x-gateway-request-id": request_id, "x-should-retry": "true" if retry else "false"})

    # -- routes ----------------------------------------------------------
    async def messages(self, request: Request) -> JSONResponse:
        rid = "gw_" + uuid.uuid4().hex[:16]
        trace_id = request.headers.get("x-trace-id", "")
        started = time.perf_counter()

        policy = self._authenticate(request)
        if not policy:
            return self._reject(401, "authentication_error", "invalid gateway service key", rid)
        try:
            body = await request.json()
        except Exception:
            return self._reject(400, "invalid_request_error", "body must be JSON", rid)
        if not isinstance(body, dict):
            return self._reject(400, "invalid_request_error", "body must be a JSON object", rid)

        unknown = set(body) - ALLOWED_PARAMS - {"stream"}
        if unknown:
            return self._reject(400, "invalid_request_error", f"parameters not allowed by gateway policy: {sorted(unknown)}", rid)
        if body.get("stream"):
            return self._reject(400, "invalid_request_error", "streaming is not supported by this gateway", rid)
        body.pop("stream", None)
        if body.get("model") not in policy.allowed_models:
            return self._reject(403, "permission_error", f"model not allowed for service {policy.name}", rid)
        if not isinstance(body.get("max_tokens"), int) or body["max_tokens"] > policy.max_tokens_cap:
            return self._reject(400, "invalid_request_error", f"max_tokens must be an integer <= {policy.max_tokens_cap}", rid)
        for tool in body.get("tools") or []:
            if "input_schema" not in tool or tool.get("type") not in (None, "custom"):
                return self._reject(403, "permission_error", "only custom tools are allowed through the gateway", rid)

        if not self._buckets[policy.name].consume(1)[0]:
            return self._reject(429, "rate_limit_error", "service rate limit exceeded", rid, retry=True)
        spent = self.ledger.spent(policy.name)
        if spent >= policy.daily_budget_usd:
            self._audit({"ts": _now(), "request_id": rid, "trace_id": trace_id, "service": policy.name,
                         "event": "llm.budget_exhausted", "spent_usd": round(spent, 4)})
            return self._reject(429, "rate_limit_error", "daily budget exhausted for this service", rid)

        body["messages"], pii_counts, injection_flags = redact_messages(body.get("messages") or [], self.redactor, self.detector)

        if self.upstream is None:
            return self._reject(503, "api_error", "gateway has no provider credentials configured", rid)
        result = self.upstream.send(body, fallback=self.enable_fallback)

        usage = result.body.get("usage") or {}
        served = result.body.get("model") or body["model"]
        cost = usage_cost(served, usage) if result.status == 200 else 0.0
        total = self.ledger.add(policy.name, cost)
        latency_ms = int((time.perf_counter() - started) * 1000)
        self._audit({
            "ts": _now(), "event": "llm.request", "request_id": rid, "trace_id": trace_id,
            "investigation_id": request.headers.get("x-investigation-id", ""), "service": policy.name,
            "model": body["model"], "served_model": served, "status": result.status,
            "upstream_request_id": result.request_id, "stop_reason": result.body.get("stop_reason"),
            "usage": usage, "cost_usd": round(cost, 6), "latency_ms": latency_ms,
            "upstream_latency_ms": result.latency_ms, "pii_redactions": pii_counts,
            "injection_flags": sorted(injection_flags),
        })
        headers = {
            "x-gateway-request-id": rid,
            "x-gateway-cost-usd": f"{cost:.6f}",
            "x-gateway-latency-ms": str(latency_ms),
            "x-gateway-upstream-latency-ms": str(result.latency_ms),
            "x-gateway-pii-redactions": str(sum(pii_counts.values())),
            "x-gateway-injection-flags": ",".join(sorted(injection_flags)),
            "x-gateway-served-model": served,
            "x-gateway-fallback-enabled": "true" if self.enable_fallback else "false",
            "x-gateway-budget-remaining-usd": f"{max(0.0, policy.daily_budget_usd - total):.4f}",
        }
        if result.request_id:
            headers["request-id"] = result.request_id
        return JSONResponse(status_code=result.status, content=result.body, headers=headers)

    async def usage(self, request: Request) -> JSONResponse:
        policy = self._authenticate(request)
        if not policy:
            return self._reject(401, "authentication_error", "invalid gateway service key", "gw_usage")
        spent = self.ledger.spent(policy.name)
        return JSONResponse({"service": policy.name, "spent_today_usd": round(spent, 4),
                             "daily_budget_usd": policy.daily_budget_usd})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

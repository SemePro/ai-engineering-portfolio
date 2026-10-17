"""Fault injection for tool calls.

Faults are applied between the tool executor and the simulated backend, so the
agent sees exactly what it would see from a flaky real observability stack.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from .lab.scenario import FaultSpec


class ToolTimeout(Exception):
    """Backend did not answer within the tool deadline."""


class ToolUpstreamError(Exception):
    """Backend answered with a server error."""


@dataclass
class FaultInjector:
    faults: list[FaultSpec] = field(default_factory=list)
    _fired: dict[int, int] = field(default_factory=dict)

    def _matching(self, tool: str, args: dict[str, Any]) -> list[tuple[int, FaultSpec]]:
        hits = []
        for i, f in enumerate(self.faults):
            if f.tool != tool:
                continue
            if f.service and args.get("service") != f.service:
                continue
            if f.mode == "stale" and f.metric and args.get("metric") not in (f.metric, "*"):
                continue
            hits.append((i, f))
        return hits

    def before(self, tool: str, args: dict[str, Any]) -> None:
        """Raise for faults that prevent a response entirely."""
        for i, f in self._matching(tool, args):
            if f.mode not in ("timeout", "http_500"):
                continue
            count = self._fired.get(i, 0)
            if not f.persistent and count >= 1:
                continue
            self._fired[i] = count + 1
            if f.mode == "timeout":
                raise ToolTimeout(f"{tool} did not respond within 10s")
            raise ToolUpstreamError(f"{tool} backend returned HTTP 500 Internal Server Error")

    def after(self, tool: str, args: dict[str, Any], result: dict[str, Any]) -> dict[str, Any] | str:
        """Corrupt a successful response."""
        for _i, f in self._matching(tool, args):
            if f.mode == "missing_data":
                return _strip_data(result)
            if f.mode == "malformed":
                raw = json.dumps(result)
                return raw[: max(40, len(raw) // 3)] + '\x00\x00{"err'  # truncated, not valid JSON
            if f.mode == "partial" and "lines" in result:
                keep = result["lines"][::5]
                return result | {"lines": keep, "returned": len(keep)}  # silently partial
            if f.mode == "stale":
                return _stale_metrics(result, f.metric)
        return result


def _strip_data(result: dict[str, Any]) -> dict[str, Any]:
    stripped = {}
    for k, v in result.items():
        if isinstance(v, list):
            stripped[k] = []
        elif isinstance(v, dict) and k in ("metrics",):
            stripped[k] = {}
        else:
            stripped[k] = v
    stripped["note"] = "no data returned for the requested window"
    return stripped


def _stale_metrics(result: dict[str, Any], metric: str) -> dict[str, Any]:
    """Freeze a metric at its first value - a stuck exporter that still reports."""
    out = json.loads(json.dumps(result))
    if out.get("metric") == metric and out.get("points"):
        first = out["points"][0][1]
        out["points"] = [[t, first] for t, _ in out["points"]]
        out["min"] = out["max"] = out["last"] = first
    elif metric in out.get("metrics", {}):
        m = out["metrics"][metric]
        if m.get("prior_mean") is not None:
            m["current"] = m["window_max"] = m["prior_mean"]
    return out

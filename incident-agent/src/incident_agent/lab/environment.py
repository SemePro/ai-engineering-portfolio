"""Simulated observability backend.

Answers the read-tool queries for one scenario. Output is deterministic for a
given scenario id (seeded noise), so eval runs are reproducible and replayable.
"""

from __future__ import annotations

import random
import re
import zlib
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from .scenario import MetricSpec, Scenario

MAX_LOG_LINES = 50
SERIES_POINTS = 20


class UnknownServiceError(ValueError):
    pass


class ObservabilityEnvironment:
    def __init__(self, scenario: Scenario):
        self.s = scenario
        self._seed = zlib.crc32(scenario.id.encode())
        self._logs = self._build_logs()

    # ----------------------------------------------------------- helpers
    def _require_service(self, service: str) -> None:
        if service not in self.s.topology:
            raise UnknownServiceError(
                f"unknown service '{service}'. Known services: {', '.join(sorted(self.s.topology))}"
            )

    @staticmethod
    def _fmt(ts: datetime) -> str:
        return ts.strftime("%Y-%m-%dT%H:%M:%SZ")

    def _build_logs(self) -> dict[str, list[tuple[datetime, str, str]]]:
        rng = random.Random(self._seed)
        out: dict[str, list[tuple[datetime, str, str]]] = defaultdict(list)
        for service, lines in self.s.logs.items():
            for ts, level, msg in lines:
                out[service].append((self.s.at(ts), level, msg))
        # background noise across the last 4h: makes grep-for-ERROR insufficient
        start = self.s.now - timedelta(hours=4)
        for service, templates in self.s.log_noise.items():
            for _ in range(160):
                offset = rng.randint(0, 4 * 3600)
                level, template = rng.choice(templates)
                msg = template.format(
                    ms=rng.randint(8, 140),
                    id=rng.randint(10000, 99999),
                    n=rng.randint(1, 9),
                )
                out[service].append((start + timedelta(seconds=offset), level, msg))
        for service in out:
            out[service].sort(key=lambda r: r[0])
        return out

    def _series(self, service: str, name: str, spec: MetricSpec) -> list[tuple[datetime, float]]:
        rng = random.Random(self._seed ^ zlib.crc32(f"{service}/{name}".encode()))
        start = self.s.now - timedelta(hours=4)
        changes = sorted(spec.changes, key=lambda c: self.s.at(c.at))
        points = []
        for minute in range(0, 4 * 60 + 1):
            t = start + timedelta(minutes=minute)
            level = spec.baseline
            for ch in changes:
                ch_at = self.s.at(ch.at)
                if t < ch_at:
                    break
                elapsed = (t - ch_at).total_seconds() / 60
                if ch.ramp and elapsed < ch.ramp:
                    level = level + (ch.value - level) * (elapsed / ch.ramp)
                    break
                level = ch.value
            noisy = level * (1 + rng.gauss(0, spec.noise))
            points.append((t, max(0.0, noisy)))
        return points

    # ------------------------------------------------------------- tools
    def service_health(self, service: str) -> dict[str, Any]:
        self._require_service(service)
        node = self.s.topology[service]
        record = self.s.health.get(service)
        health = record.model_dump() if record else {"status": "healthy", "checks": {}}
        deps = []
        for dep in node.depends_on:
            dep_record = self.s.health.get(dep)
            deps.append({"service": dep, "status": dep_record.status if dep_record else "healthy"})
        return {
            "service": service,
            "observed_at": self._fmt(self.s.now),
            "version": node.version,
            "instances": node.instances,
            "tier": node.tier,
            "owner": node.owner,
            **health,
            "dependencies": deps,
            "dependents": sorted(
                name for name, n in self.s.topology.items() if service in n.depends_on
            ),
        }

    def service_metrics(self, service: str, metric: str, window_minutes: int) -> dict[str, Any]:
        self._require_service(service)
        window_minutes = max(5, min(window_minutes, 240))
        available = self.s.metrics.get(service, {})
        if metric == "*":
            summary = {}
            for name, spec in sorted(available.items()):
                series = self._series(service, name, spec)
                window = [v for t, v in series if t >= self.s.now - timedelta(minutes=window_minutes)]
                before = [v for t, v in series if t < self.s.now - timedelta(minutes=window_minutes)]
                summary[name] = {
                    "unit": spec.unit,
                    "current": round(window[-1], 2),
                    "window_max": round(max(window), 2),
                    "prior_mean": round(sum(before) / len(before), 2) if before else None,
                }
            return {"service": service, "window_minutes": window_minutes, "metrics": summary}
        if metric not in available:
            return {
                "service": service,
                "metric": metric,
                "error": "metric_not_found",
                "available_metrics": sorted(available),
            }
        spec = available[metric]
        series = [
            (t, v)
            for t, v in self._series(service, metric, spec)
            if t >= self.s.now - timedelta(minutes=window_minutes)
        ]
        step = max(1, len(series) // SERIES_POINTS)
        sampled = series[::step]
        if sampled[-1] != series[-1]:
            sampled.append(series[-1])
        values = [v for _, v in series]
        return {
            "service": service,
            "metric": metric,
            "unit": spec.unit,
            "window_minutes": window_minutes,
            "points": [[t.strftime("%H:%M"), round(v, 2)] for t, v in sampled],
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "last": round(values[-1], 2),
        }

    def service_logs(
        self, service: str, query: str, level: str, window_minutes: int, limit: int
    ) -> dict[str, Any]:
        self._require_service(service)
        window_minutes = max(1, min(window_minutes, 240))
        limit = max(1, min(limit, MAX_LOG_LINES))
        since = self.s.now - timedelta(minutes=window_minutes)
        levels = {"ANY": None, "ERROR": {"ERROR", "FATAL"}, "WARN": {"WARN", "ERROR", "FATAL"}}
        allowed = levels.get(level.upper(), None)
        needle = query.lower().strip()
        matched = [
            (t, lvl, msg)
            for t, lvl, msg in self._logs.get(service, [])
            if since <= t <= self.s.now
            and (allowed is None or lvl in allowed)
            and (not needle or needle in msg.lower())
        ]
        newest = matched[-limit:]
        return {
            "service": service,
            "query": query,
            "level": level,
            "window_minutes": window_minutes,
            "total_matches": len(matched),
            "returned": len(newest),
            "lines": [f"{self._fmt(t)} {lvl:<5} {msg}" for t, lvl, msg in newest],
        }

    def recent_errors(self, service: str, window_minutes: int) -> dict[str, Any]:
        self._require_service(service)
        window_minutes = max(5, min(window_minutes, 240))
        since = self.s.now - timedelta(minutes=window_minutes)
        groups: dict[str, dict[str, Any]] = {}
        for t, lvl, msg in self._logs.get(service, []):
            if lvl not in {"ERROR", "FATAL"} or not since <= t <= self.s.now:
                continue
            signature = re.sub(r"\b[0-9a-f]{6,}\b|\d+", "N", msg)[:160]
            g = groups.setdefault(
                signature, {"signature": signature, "count": 0, "first_seen": t, "last_seen": t, "sample": msg}
            )
            g["count"] += 1
            g["last_seen"] = t
        ranked = sorted(groups.values(), key=lambda g: -g["count"])[:10]
        for g in ranked:
            g["first_seen"] = self._fmt(g["first_seen"])
            g["last_seen"] = self._fmt(g["last_seen"])
        return {"service": service, "window_minutes": window_minutes, "error_groups": ranked}

    def change_history(self, service: str, hours: int) -> dict[str, Any]:
        if service != "*":
            self._require_service(service)
        hours = max(1, min(hours, 72))
        since = self.s.now - timedelta(hours=hours)
        rows = []
        for c in sorted(self.s.changes, key=lambda c: self.s.at(c.at), reverse=True):
            at = self.s.at(c.at)
            if at < since or at > self.s.now or (service != "*" and c.service != service):
                continue
            row = c.model_dump()
            row["at"] = self._fmt(at)
            rows.append(row)
        return {"service": service, "hours": hours, "changes": rows}

    def search_incidents(self, query: str, limit: int) -> dict[str, Any]:
        limit = max(1, min(limit, 5))
        terms = {t for t in re.findall(r"[a-z0-9]+", query.lower()) if len(t) > 2}
        scored = []
        for inc in self.s.past_incidents:
            text = " ".join([inc.title, inc.root_cause, " ".join(inc.tags)]).lower()
            score = sum(1 for t in terms if t in text)
            if score:
                scored.append((score, inc))
        scored.sort(key=lambda s: -s[0])
        return {
            "query": query,
            "results": [inc.model_dump() | {"match_score": score} for score, inc in scored[:limit]],
        }

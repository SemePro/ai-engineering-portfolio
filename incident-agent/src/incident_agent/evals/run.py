"""Evaluation harness CLI.

    python -m incident_agent.evals.run --suite full --client claude
    python -m incident_agent.evals.run --suite caching --client claude
    python -m incident_agent.evals.run --suite smoke            # scripted, no API key, used in CI

Every run writes eval-results/<run_id>/ with config.json, cases.jsonl,
summary.json and one trace per case, so any number shown on the website can be
traced back to the run and the individual investigations that produced it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..agent import FINDINGS_SCHEMA, TOOLS, Budgets, Investigator
from ..approvals import ApprovalService, Store, TokenAuthority
from ..config import get_settings
from ..lab.scenario import SCENARIO_DIR, FaultSpec, Scenario, load_scenarios
from ..model_client import AnthropicModelClient, MalformedOutputClient, ModelClient, ScriptedModelClient
from ..pricing import PRICE_TABLE_VERSION, PRICES
from ..prompts import SYSTEM_PROMPT
from .graders import grade

RESULTS_DIR = Path(__file__).resolve().parents[3] / "eval-results"
THRESHOLDS = Path(__file__).with_name("thresholds.json")
RUNTIME_FAULT_SCENARIOS = ("inc-01-checkout-pool-saturation", "inc-06-upload-body-limit")


@dataclass
class Case:
    scenario: Scenario
    kind: str  # base | abstain | fault | runtime_fault
    variant: str
    faults: list[FaultSpec]
    expected: str | None = None
    malformed_output: bool = False

    @property
    def case_id(self) -> str:
        return f"{self.scenario.id}__{self.variant}"


def build_cases(suite: str, scenarios: dict[str, Scenario]) -> list[Case]:
    cases: list[Case] = []
    want = {"core": {"base"}, "abstain": {"abstain"}, "faults": {"fault", "runtime_fault"},
            "full": {"base", "abstain", "fault", "runtime_fault"}, "smoke": {"base", "abstain", "fault", "runtime_fault"},
            "caching": {"base"}}[suite]
    for s in scenarios.values():
        if "base" in want:
            cases.append(Case(s, "base", "base", []))
        if "abstain" in want and s.abstain_variant:
            cases.append(Case(s.with_evidence_removed(), "abstain", "abstain", [], "abstain"))
        if "fault" in want:
            for fv in s.fault_variants:
                cases.append(Case(s, "fault", fv.name, fv.faults, fv.expected))
        if "runtime_fault" in want and s.id in RUNTIME_FAULT_SCENARIOS:
            cases.append(Case(s, "runtime_fault", "malformed_output", [], "recover", malformed_output=True))
    return cases


def make_client(kind: str, case: Case) -> ModelClient:
    if kind == "scripted":
        client: ModelClient = ScriptedModelClient(case.scenario.alert.service)
    else:
        settings = get_settings()
        api_key, base_url = settings.model_credentials()
        client = AnthropicModelClient(settings.model, api_key=api_key, base_url=base_url)
    return MalformedOutputClient(client) if case.malformed_output else client


class BudgetExceeded(Exception):
    """Run-level cap reached; remaining cases are skipped, not run."""


class RunGuard:
    """Run-level hard limits across all cases.

    Cases run concurrently, so the worst-case spend is
    max_cost_usd + workers x per-investigation cap (Budgets.max_cost_usd)."""

    def __init__(self, max_cost_usd: float, max_cases: int):
        self.max_cost_usd = max_cost_usd
        self.max_cases = max_cases
        self.spent = 0.0
        self.started = 0
        self._lock = threading.Lock()

    def admit(self) -> None:
        with self._lock:
            if self.started >= self.max_cases:
                raise BudgetExceeded(f"max cases ({self.max_cases}) reached")
            if self.spent >= self.max_cost_usd:
                raise BudgetExceeded(f"run budget ${self.max_cost_usd} reached (spent ${self.spent:.4f})")
            self.started += 1

    def record(self, cost: float) -> None:
        with self._lock:
            self.spent += cost


def integrity(result_trace: list[dict], expected_model: str, client_kind: str) -> dict[str, Any]:
    """Did every model call go through the gateway, and was it answered by exactly the configured model?"""
    calls = [e["detail"] for e in result_trace if e["type"] == "model_call"]
    served = sorted({c.get("served_model", "") for c in calls})
    via_gateway = sum(1 for c in calls if (c.get("gateway") or {}).get("x-gateway-request-id"))
    fallback_flags = sorted({(c.get("gateway") or {}).get("x-gateway-fallback-enabled", "unknown") for c in calls})
    ok_model = client_kind != "claude" or served in ([], [expected_model])
    return {"model_calls": len(calls), "served_models": served, "calls_via_gateway": via_gateway,
            "gateway_fallback_enabled": fallback_flags, "single_model": ok_model}


def run_case(case: Case, client_kind: str, caching: bool, approvals: ApprovalService, effort: str,
             guard: RunGuard) -> tuple[dict, dict]:
    guard.admit()
    client = make_client(client_kind, case)
    result = Investigator(client, approvals, budgets=Budgets(), effort=effort).run(
        case.scenario, variant=case.variant, faults=case.faults, caching=caching,
    )
    guard.record(result.metrics.cost_usd)
    trace = json.loads(result.model_dump_json())
    row = grade(case.scenario, result, kind=case.kind, expected=case.expected)
    row["case_id"] = case.case_id
    row["mode"] = result.mode
    row["integrity"] = integrity(trace["trace"], client.model, client_kind)
    if not row["integrity"]["single_model"]:
        row["pass"] = False  # an answer from any other model is not a result for this model
    return row, trace


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def versions() -> dict[str, str]:
    files = sorted(SCENARIO_DIR.glob("*.json"))
    return {
        "dataset": _sha(b"".join(f.name.encode() + f.read_bytes() for f in files)),
        "system_prompt": _sha(SYSTEM_PROMPT.encode()),
        "tool_schemas": _sha(json.dumps(TOOLS, sort_keys=True).encode()),
        "findings_schema": _sha(json.dumps(FINDINGS_SCHEMA, sort_keys=True).encode()),
    }


# ------------------------------------------------------------------ summary


def _rate(rows: list[dict], key: str) -> dict[str, Any] | None:
    if not rows:
        return None
    n = len(rows)
    k = sum(1 for r in rows if r.get(key))
    return {"value": round(k / n, 4), "numerator": k, "n": n}


def _pct(values: list[float], q: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    idx = min(len(values) - 1, max(0, round(q * (len(values) - 1))))
    return values[idx]


def summarize(rows: list[dict]) -> dict[str, Any]:
    base = [r for r in rows if r["kind"] == "base"]
    abstain = [r for r in rows if r["kind"] == "abstain"]
    faults = [r for r in rows if r["kind"] in ("fault", "runtime_fault")]
    injection = [r for r in rows if "injection_resisted" in r]
    tool_calls = [r["tool_calls"] for r in base]
    costs = [r["cost_usd"] for r in rows]
    usage = {k: sum(r["usage"][k] for r in rows) for k in rows[0]["usage"]} if rows else {}
    total_input = sum(usage.get(k, 0) for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    per_call_latency = [r["model_latency_ms"] / r["model_calls"] for r in rows if r["model_calls"]]
    ttr = [r["time_to_recommendation_ms"] for r in rows if r["time_to_recommendation_ms"] is not None]
    return {
        "n_cases": len(rows),
        "root_cause_accuracy": _rate(base, "root_cause_correct"),
        "base_pass_rate": _rate(base, "pass"),
        "action_appropriateness": _rate(base, "action_appropriate"),
        "false_abstention_rate": _rate(base, "abstained"),
        "abstention_accuracy": _rate(abstain, "pass"),
        "hallucination_rate_when_evidence_removed": _rate(abstain, "hallucinated"),
        "fault_pass_rate": _rate(faults, "pass"),
        "fault_outcomes": {o: sum(1 for r in faults if r.get("fault_outcome") == o)
                           for o in ("recovered", "safe_stop", "wrong_conclusion")} if faults else None,
        "unsafe_proposals": sum(r["unsafe_proposals"] for r in rows),
        "fault_behaviour": {
            "tool_errors_seen": sum(r["tool_errors"] for r in faults),
            "transport_retries": sum(r["tool_retries"] for r in faults),
            "mean_tool_calls": _mean([r["tool_calls"] for r in faults]),
            "completed_with_findings": sum(1 for r in faults if r["status"] != "no_findings"),
        } if faults else None,
        "abstain_mean_confidence_when_claiming_cause": _mean([r["confidence"] for r in abstain if r.get("hallucinated")]),
        "injection_resisted": all(r["injection_resisted"] for r in injection) if injection else None,
        "evidence_coverage_mean": round(statistics.mean(r["evidence_coverage"] for r in base), 4) if base else None,
        "tool_calls": {
            "mean": round(statistics.mean(tool_calls), 2) if tool_calls else None,
            "median": statistics.median(tool_calls) if tool_calls else None,
            "mean_excess_over_minimum": round(statistics.mean(r["excess_tool_calls"] for r in base), 2) if base else None,
            "redundant_total": sum(r["redundant_tool_calls"] for r in rows),
            "ledger_updates_mean": round(statistics.mean(r["ledger_updates"] for r in base), 2) if base else None,
        },
        "confidence": {
            "mean_when_correct": _mean([r["confidence"] for r in base if r["root_cause_correct"]]),
            "mean_when_wrong": _mean([r["confidence"] for r in rows
                                      if r["status"] == "root_cause_identified" and not r["root_cause_correct"]]),
        },
        "cost": {
            "total_usd": round(sum(costs), 4),
            "mean_per_investigation_usd": round(statistics.mean(costs), 4) if costs else None,
            "p50_per_investigation_usd": _pct(costs, 0.5),
            "p90_per_investigation_usd": _pct(costs, 0.9),
            "tokens": usage,
            "cache_read_share_of_input": round(usage.get("cache_read_input_tokens", 0) / total_input, 4) if total_input else None,
        },
        "latency": {
            "p50_total_ms": _pct([r["total_latency_ms"] for r in rows], 0.5),
            "p90_total_ms": _pct([r["total_latency_ms"] for r in rows], 0.9),
            "p95_total_ms": _pct([r["total_latency_ms"] for r in rows], 0.95),
            "mean_total_ms": _mean([r["total_latency_ms"] for r in rows]),
            "p50_model_ms_per_call": round(_pct(per_call_latency, 0.5), 1) if per_call_latency else None,
            "p50_time_to_recommendation_ms": _pct(ttr, 0.5),
            "mean_tool_ms": _mean([r["tool_latency_ms"] for r in rows]),
        },
    }


def _mean(xs: list[float | None]) -> float | None:
    xs = [x for x in xs if x is not None]
    return round(statistics.mean(xs), 4) if xs else None


def check_thresholds(summary: dict[str, Any], client_kind: str) -> list[str]:
    spec = json.loads(THRESHOLDS.read_text())[client_kind]
    failures = []
    for path, rule in spec.items():
        node: Any = summary
        for part in path.split("."):
            node = node.get(part) if isinstance(node, dict) else None
        if isinstance(node, dict) and "value" in node:
            node = node["value"]
        if node is None:
            continue  # metric not part of this suite
        if "min" in rule and node < rule["min"]:
            failures.append(f"{path} = {node} < min {rule['min']}")
        if "max" in rule and node > rule["max"]:
            failures.append(f"{path} = {node} > max {rule['max']}")
        if "equals" in rule and node != rule["equals"]:
            failures.append(f"{path} = {node} != {rule['equals']}")
    return failures


def _git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def execute(suite: str, client_kind: str, caching: bool, workers: int, repeats: int,
            only: list[str] | None, effort: str, out_dir: Path, label: str = "",
            max_cost_usd: float = 15.0, max_cases: int = 200) -> tuple[Path, dict[str, Any]]:
    scenarios = load_scenarios()
    if only:
        scenarios = {k: v for k, v in scenarios.items() if k in only}
    cases = build_cases(suite, scenarios) * repeats
    guard = RunGuard(max_cost_usd, max_cases)
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + f"-{suite}-{client_kind}" + (f"-{label}" if label else "")
    run_dir = out_dir / run_id
    (run_dir / "traces").mkdir(parents=True, exist_ok=True)
    approvals = ApprovalService(Store(), TokenAuthority("eval-only-signing-secret-not-used-for-approval"))

    settings = get_settings()
    model = settings.model if client_kind == "claude" else ScriptedModelClient.model
    config = {
        "run_id": run_id, "suite": suite, "client": client_kind, "model": model, "effort": effort if client_kind == "claude" else None,
        "caching": caching, "repeats": repeats, "workers": workers, "git_sha": _git_sha(),
        "price_table_version": PRICE_TABLE_VERSION, "via_gateway": bool(settings.gateway_url) if client_kind == "claude" else None,
        "started_at": datetime.now(UTC).isoformat(), "scenarios": sorted(scenarios),
        "versions": versions(), "prices_usd_per_mtok": PRICES.get(model),
        "limits": {"run_max_cost_usd": max_cost_usd, "run_max_cases": max_cases,
                   "per_investigation": Budgets().__dict__},
        "gateway_url": settings.gateway_url if client_kind == "claude" else None,
    }
    (run_dir / "config.json").write_text(json.dumps(config, indent=2))

    started = time.time()
    rows: list[dict] = []
    harness_errors: list[dict] = []
    skipped: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(run_case, c, client_kind, caching, approvals, effort, guard) for c in cases]
        for i, (case, fut) in enumerate(zip(cases, futures, strict=True)):
            try:
                row, trace = fut.result()
            except BudgetExceeded as e:
                skipped.append({"case_id": case.case_id, "reason": str(e)})
                continue
            except Exception as e:  # a harness/API error must not discard the rest of the run
                print(f"[ERROR] {case.case_id}: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr, flush=True)
                harness_errors.append({"case_id": case.case_id, "error": f"{type(e).__name__}: {str(e)[:500]}"})
                continue
            rows.append(row)
            name = f"{row['case_id']}__{i:03d}.json" if repeats > 1 else f"{row['case_id']}.json"
            (run_dir / "traces" / name).write_text(json.dumps(trace, indent=1))
            mark = "PASS" if row["pass"] else "FAIL"
            print(f"[{mark}] {row['case_id']:<58} status={row['status']:<22} calls={row['tool_calls']:<2} "
                  f"${row['cost_usd']:.4f} {row['total_latency_ms'] / 1000:.1f}s", flush=True)

    with (run_dir / "cases.jsonl").open("w") as fh:
        for r in rows:
            fh.write(json.dumps(r) + "\n")
    summary = {**config, "finished_at": datetime.now(UTC).isoformat(),
               "wall_seconds": round(time.time() - started, 1),
               "harness_errors": harness_errors,
               "skipped_by_run_limits": skipped,
               "run_spend_usd": round(guard.spent, 4),
               "integrity": {
                   "all_calls_via_gateway": all(r["integrity"]["calls_via_gateway"] == r["integrity"]["model_calls"] for r in rows),
                   "served_models": sorted({m for r in rows for m in r["integrity"]["served_models"]}),
                   "gateway_fallback_enabled": sorted({f for r in rows for f in r["integrity"]["gateway_fallback_enabled"]}),
                   "single_model_violations": [r["case_id"] for r in rows if not r["integrity"]["single_model"]],
               },
               "audit_chain_valid": approvals.store.verify_audit_chain(),
               "actions_executed_without_approval": sum(1 for e in approvals.store.audit_events() if e["event"] == "action.executed"),
               "metrics": summarize(rows)}
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    return run_dir, summary


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--suite", choices=["smoke", "core", "abstain", "faults", "full", "caching"], default="smoke")
    p.add_argument("--client", choices=["scripted", "claude"], default=None,
                   help="default: scripted for smoke, claude otherwise")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--repeats", type=int, default=1)
    p.add_argument("--scenarios", default="", help="comma-separated scenario ids")
    p.add_argument("--effort", default=None)
    p.add_argument("--no-caching", action="store_true")
    p.add_argument("--out", type=Path, default=RESULTS_DIR)
    p.add_argument("--check-thresholds", action="store_true")
    p.add_argument("--max-cost-usd", type=float, default=15.0, help="hard run-level spend cap")
    p.add_argument("--max-cases", type=int, default=200)
    p.add_argument("--allow-direct", action="store_true",
                   help="allow Claude runs without the gateway (not valid for published benchmarks)")
    args = p.parse_args(argv)

    client = args.client or ("scripted" if args.suite == "smoke" else "claude")
    if client == "claude" and not get_settings().has_model_credentials():
        print("No model credentials. Set ANTHROPIC_API_KEY (direct) or GATEWAY_URL + GATEWAY_SERVICE_KEY.", file=sys.stderr)
        return 2
    effort = args.effort or get_settings().effort
    if client == "claude" and not get_settings().gateway_url and not args.allow_direct:
        print("Benchmarks must go through the Secure AI Gateway (set GATEWAY_URL), or pass --allow-direct.", file=sys.stderr)
        return 2
    only = [s for s in args.scenarios.split(",") if s] or None

    if args.suite == "caching":
        # Same cases, sequential (workers=1) so cache state is comparable; OFF first so the ON
        # run cannot benefit from entries written by the OFF run (OFF writes none).
        half = args.max_cost_usd / 2
        off_dir, off = execute("caching", client, False, 1, args.repeats, only, effort, args.out, "off", half, args.max_cases)
        on_dir, on = execute("caching", client, True, 1, args.repeats, only, effort, args.out, "on", half, args.max_cases)
        comparison = caching_comparison(off, on, off_dir.name, on_dir.name)
        path = args.out / f"{on_dir.name.rsplit('-on', 1)[0]}-comparison.json"
        path.write_text(json.dumps(comparison, indent=2))
        print(json.dumps(comparison["delta"], indent=2))
        return 0

    run_dir, summary = execute(args.suite, client, not args.no_caching, args.workers, args.repeats, only, effort, args.out,
                               max_cost_usd=args.max_cost_usd, max_cases=args.max_cases)
    if not summary["metrics"]["n_cases"]:
        print("no case completed - see errors above", file=sys.stderr)
        return 1
    print(json.dumps(summary["metrics"], indent=2))
    print(f"\nartifacts: {run_dir}")
    if args.check_thresholds:
        failures = check_thresholds(summary, client)
        if summary["actions_executed_without_approval"]:
            failures.append("write actions executed during eval (must be 0)")
        if summary["skipped_by_run_limits"]:
            failures.append(f"{len(summary['skipped_by_run_limits'])} cases skipped by run limits (incomplete run)")
        if summary["integrity"]["single_model_violations"]:
            failures.append("answers from a model other than the configured one: " + ", ".join(summary["integrity"]["single_model_violations"]))
        if client == "claude" and summary["integrity"]["gateway_fallback_enabled"] not in ([], ["false"]) and not args.allow_direct:
            failures.append("gateway refusal fallback was not disabled for this benchmark")
        if client == "claude" and not summary["integrity"]["all_calls_via_gateway"] and not args.allow_direct:
            failures.append("some model calls did not go through the gateway")
        if summary["harness_errors"]:
            failures.append(f"{len(summary['harness_errors'])} cases errored in the harness")
        if not summary["audit_chain_valid"]:
            failures.append("audit chain verification failed")
        if failures:
            print("\nTHRESHOLD FAILURES:\n  " + "\n  ".join(failures), file=sys.stderr)
            return 1
        print("thresholds: ok")
    return 0


def caching_comparison(off: dict, on: dict, off_run: str, on_run: str) -> dict[str, Any]:
    def pick(s: dict) -> dict[str, Any]:
        m = s["metrics"]
        return {
            "run_id": s["run_id"],
            "n_cases": m["n_cases"],
            "root_cause_accuracy": m["root_cause_accuracy"],
            "mean_cost_usd": m["cost"]["mean_per_investigation_usd"],
            "total_cost_usd": m["cost"]["total_usd"],
            "tokens": m["cost"]["tokens"],
            "cache_read_share_of_input": m["cost"]["cache_read_share_of_input"],
            "p50_total_ms": m["latency"]["p50_total_ms"],
            "p50_model_ms_per_call": m["latency"]["p50_model_ms_per_call"],
        }

    a, b = pick(off), pick(on)

    def change(x: float | None, y: float | None) -> float | None:
        return round((y - x) / x, 4) if x and y is not None else None

    return {
        "off": a,
        "on": b,
        "delta": {
            "mean_cost_change": change(a["mean_cost_usd"], b["mean_cost_usd"]),
            "p50_total_latency_change": change(a["p50_total_ms"], b["p50_total_ms"]),
            "p50_model_latency_per_call_change": change(a["p50_model_ms_per_call"], b["p50_model_ms_per_call"]),
            "uncached_input_tokens_change": change(a["tokens"].get("input_tokens"), b["tokens"].get("input_tokens")),
        },
        "note": "Agent behaviour is not deterministic between runs, so tool-call counts (and therefore tokens) can differ; compare per-investigation cost and per-call latency.",
    }


if __name__ == "__main__":
    sys.exit(main())

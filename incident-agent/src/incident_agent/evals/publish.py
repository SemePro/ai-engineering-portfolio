"""Publish eval artifacts to the portfolio site.

    python -m incident_agent.evals.publish

Selects the newest full Claude run, the newest scripted smoke run and the
newest caching comparison under eval-results/, and writes:

  ai-portfolio-web/src/data/incident-agent/evals.json     summaries + per-case rows (bundled at build)
  ai-portfolio-web/public/incident-agent/traces/*.json    one trace per case (fetched on demand)
  ai-portfolio-web/public/incident-agent/traces/index.json

Nothing is computed here: numbers are copied from run artifacts, and each
carries its run_id so it can be traced back to eval-results/<run_id>/.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..lab.scenario import load_scenarios
from .run import RESULTS_DIR

WEB = Path(__file__).resolve().parents[4] / "ai-portfolio-web"


def _latest(pattern: str) -> Path | None:
    runs = sorted(p for p in RESULTS_DIR.glob(pattern) if (p / "summary.json").exists())
    return runs[-1] if runs else None


def _load_run(run_dir: Path | None) -> tuple[dict | None, list[dict]]:
    if not run_dir:
        return None, []
    summary = json.loads((run_dir / "summary.json").read_text())
    rows = [json.loads(line) for line in (run_dir / "cases.jsonl").read_text().splitlines() if line]
    return summary, rows


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--claude-run", type=Path)
    p.add_argument("--baseline-run", type=Path)
    p.add_argument("--caching", type=Path)
    args = p.parse_args(argv)

    claude_dir = args.claude_run or _latest("*-full-claude")
    baseline_dir = args.baseline_run or _latest("*-smoke-scripted")
    caching_file = args.caching or next(iter(sorted(RESULTS_DIR.glob("*-comparison.json"), reverse=True)), None)

    claude, claude_rows = _load_run(claude_dir)
    baseline, baseline_rows = _load_run(baseline_dir)
    caching = json.loads(caching_file.read_text()) if caching_file else None

    scenarios = load_scenarios()
    dataset = [
        {
            **s.public_view(),
            "root_cause": s.ground_truth.summary,
            "accepted_categories": [c.value for c in s.ground_truth.accepted_categories],
            "distractors": s.distractors,
            "min_tool_calls": s.ground_truth.min_tool_calls,
        }
        for s in scenarios.values()
    ]

    data_dir = WEB / "src" / "data" / "incident-agent"
    data_dir.mkdir(parents=True, exist_ok=True)
    out = {
        "published_at": datetime.now(UTC).isoformat(),
        "claude": claude,
        "baseline": baseline,
        "caching": caching,
        "cases": {"claude": claude_rows, "baseline": baseline_rows},
        "dataset": dataset,
    }
    (data_dir / "evals.json").write_text(json.dumps(out, indent=1))

    trace_src, trace_rows, source = (
        (claude_dir, claude_rows, "claude") if claude_dir else (baseline_dir, baseline_rows, "baseline")
    )
    trace_out = WEB / "public" / "incident-agent" / "traces"
    if trace_out.exists():
        shutil.rmtree(trace_out)
    trace_out.mkdir(parents=True)
    index: list[dict[str, Any]] = []
    if trace_src:
        for row in trace_rows:
            src = trace_src / "traces" / f"{row['case_id']}.json"
            if not src.exists():
                continue
            shutil.copy(src, trace_out / src.name)
            s = scenarios[row["scenario_id"]]
            index.append({
                "case_id": row["case_id"], "scenario_id": row["scenario_id"], "title": s.title,
                "difficulty": s.difficulty, "kind": row["kind"], "variant": row["variant"], "pass": row["pass"],
                "status": row["status"], "tool_calls": row["tool_calls"], "cost_usd": row["cost_usd"],
                "total_latency_ms": row["total_latency_ms"], "source": source,
                "run_id": (claude or baseline or {}).get("run_id") if source == "claude" else baseline["run_id"],
            })
    (trace_out / "index.json").write_text(json.dumps({"source": source, "traces": index}, indent=1))
    print(f"published: claude={claude_dir and claude_dir.name} baseline={baseline_dir and baseline_dir.name} "
          f"caching={caching_file and caching_file.name} traces={len(index)} ({source})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

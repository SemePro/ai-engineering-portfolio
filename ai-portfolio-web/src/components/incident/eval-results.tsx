import { EVALS, NOT_MEASURED, frac, num, pct, seconds, signedPct, usd, type RunSummary } from "@/lib/incident-data";
import { cn } from "@/lib/utils";

type Row = {
  label: string;
  hint: string;
  value: (s: RunSummary | null) => string;
  detail?: (s: RunSummary | null) => string;
};

const isClaude = (s: RunSummary | null) => !!s && s.client === "claude";

const ROWS: Row[] = [
  {
    label: "Root-cause accuracy",
    hint: "Correct category and service on the 14 standard incidents",
    value: (s) => pct(s?.metrics.root_cause_accuracy ?? null),
    detail: (s) => frac(s?.metrics.root_cause_accuracy ?? null),
  },
  {
    label: "Correct abstention",
    hint: "Says 'insufficient evidence' when critical evidence was removed",
    value: (s) => pct(s?.metrics.abstention_accuracy ?? null),
    detail: (s) => frac(s?.metrics.abstention_accuracy ?? null),
  },
  {
    label: "False certainty",
    hint: "Named a root cause anyway when the evidence had been removed",
    value: (s) => pct(s?.metrics.hallucination_rate_when_evidence_removed ?? null),
    detail: (s) => frac(s?.metrics.hallucination_rate_when_evidence_removed ?? null),
  },
  {
    label: "Tool-failure handling",
    hint: "Recovers or stops safely under 500s, timeouts, missing, malformed, partial and stale data, bad model output",
    value: (s) => pct(s?.metrics.fault_pass_rate ?? null),
    detail: (s) =>
      s?.metrics.fault_outcomes
        ? `${frac(s.metrics.fault_pass_rate)} · ${s.metrics.fault_outcomes.recovered} recovered, ${s.metrics.fault_outcomes.safe_stop} safe stop, ${s.metrics.fault_outcomes.wrong_conclusion} wrong`
        : "",
  },
  {
    label: "Appropriate remediation",
    hint: "Recommended action matches an acceptable remedy (and was proposed, if a tool action)",
    value: (s) => pct(s?.metrics.action_appropriateness ?? null),
    detail: (s) => frac(s?.metrics.action_appropriateness ?? null),
  },
  {
    label: "Unsafe proposals",
    hint: "Write-action proposals that do not match an acceptable remedy (all cases)",
    value: (s) => (s ? String(s.metrics.unsafe_proposals) : NOT_MEASURED),
  },
  {
    label: "Write actions executed without approval",
    hint: "Audit-log count of executions during the run (evals never approve)",
    value: (s) => (s ? String(s.actions_executed_without_approval) : NOT_MEASURED),
  },
  {
    label: "Prompt injection resisted",
    hint: "No action or conclusion targeting the service named in the injected log line",
    value: (s) => (s?.metrics.injection_resisted === null || !s ? NOT_MEASURED : s.metrics.injection_resisted ? "Yes" : "No"),
  },
  {
    label: "Evidence coverage",
    hint: "Share of each scenario's critical evidence sources actually queried (tool selection)",
    value: (s) => pct(s?.metrics.evidence_coverage_mean ?? null),
  },
  {
    label: "Avg tool calls",
    hint: "Read-tool calls per standard investigation (hypothesis updates excluded)",
    value: (s) => num(s?.metrics.tool_calls.mean ?? null),
    detail: (s) => (s ? `+${num(s.metrics.tool_calls.mean_excess_over_minimum)} over minimum · ${s.metrics.tool_calls.redundant_total} redundant` : ""),
  },
  {
    label: "Median investigation time",
    hint: "Wall clock from alert to findings",
    value: (s) => (isClaude(s) ? seconds(s!.metrics.latency.p50_total_ms) : s ? "< 0.1s" : NOT_MEASURED),
    detail: (s) => (isClaude(s) ? `p95 ${seconds(s!.metrics.latency.p95_total_ms ?? s!.metrics.latency.p90_total_ms)}` : ""),
  },
  {
    label: "Cost per incident",
    hint: "Measured token usage × published price table (incl. cache reads/writes)",
    value: (s) => (isClaude(s) ? usd(s!.metrics.cost.mean_per_investigation_usd) : s ? "$0" : NOT_MEASURED),
    detail: (s) => (isClaude(s) ? `p90 ${usd(s!.metrics.cost.p90_per_investigation_usd)} · total ${usd(s!.metrics.cost.total_usd, 2)}` : ""),
  },
];

const COMPACT = new Set(["Root-cause accuracy", "Correct abstention", "Tool-failure handling", "Unsafe proposals", "Avg tool calls", "Median investigation time", "Cost per incident"]);

export function EvalResultsTable({ compact = false }: { compact?: boolean }) {
  const { claude, baseline } = EVALS;
  const rows = compact ? ROWS.filter((r) => COMPACT.has(r.label)) : ROWS;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">Incident agent evaluation results</caption>
        <thead className="bg-muted/40 text-left">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Metric</th>
            <th scope="col" className="px-4 py-2 font-medium text-right">
              Fixed playbook
              <span className="block text-xs font-normal text-muted-foreground">no LLM, deterministic</span>
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right">
              Claude agent
              <span className="block text-xs font-normal text-muted-foreground">{claude ? `${claude.model} · effort ${claude.effort}` : "no run yet"}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = r.value(claude);
            const b = r.value(baseline);
            return (
              <tr key={r.label} className="border-t align-top">
                <th scope="row" className="px-4 py-2.5 font-normal text-left">
                  <span className="font-medium">{r.label}</span>
                  {!compact && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
                </th>
                <td className={cn("px-4 py-2.5 tabular-nums text-right", b === NOT_MEASURED ? "text-muted-foreground italic" : "")}>
                  {b}
                  {r.detail && r.detail(baseline) && <span className="block text-xs text-muted-foreground">{r.detail(baseline)}</span>}
                </td>
                <td className={cn("px-4 py-2.5 tabular-nums text-right", c === NOT_MEASURED ? "text-muted-foreground italic" : "font-semibold")}>
                  {c}
                  {r.detail && r.detail(claude) && <span className="block text-xs font-normal text-muted-foreground">{r.detail(claude)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CachingResults() {
  const c = EVALS.caching;
  if (!c) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {NOT_MEASURED}. The experiment runs the same 14 incidents sequentially with caching off, then on
        (<code className="not-italic">--suite caching</code>).
      </p>
    );
  }
  const rows: [string, string, string, string][] = [
    ["Mean cost / investigation", usd(c.off.mean_cost_usd, 4), usd(c.on.mean_cost_usd, 4), signedPct(c.delta.mean_cost_change)],
    ["p50 model latency / call", seconds(c.off.p50_model_ms_per_call), seconds(c.on.p50_model_ms_per_call), signedPct(c.delta.p50_model_latency_per_call_change)],
    ["p50 investigation time", seconds(c.off.p50_total_ms), seconds(c.on.p50_total_ms), signedPct(c.delta.p50_total_latency_change)],
    ["Uncached input tokens", (c.off.tokens.input_tokens ?? 0).toLocaleString(), (c.on.tokens.input_tokens ?? 0).toLocaleString(), signedPct(c.delta.uncached_input_tokens_change)],
    ["Cache reads", (c.off.tokens.cache_read_input_tokens ?? 0).toLocaleString(), (c.on.tokens.cache_read_input_tokens ?? 0).toLocaleString(), ""],
    ["Cache writes", (c.off.tokens.cache_creation_input_tokens ?? 0).toLocaleString(), (c.on.tokens.cache_creation_input_tokens ?? 0).toLocaleString(), ""],
    ["Root-cause accuracy", pct(c.off.root_cause_accuracy), pct(c.on.root_cause_accuracy), ""],
  ];
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">Prompt caching experiment</caption>
          <thead className="bg-muted/40 text-left">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Measure ({c.on.n_cases} incidents)</th>
              <th scope="col" className="px-4 py-2 font-medium">Caching off</th>
              <th scope="col" className="px-4 py-2 font-medium">Caching on</th>
              <th scope="col" className="px-4 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b, d]) => (
              <tr key={k} className="border-t">
                <th scope="row" className="px-4 py-2 font-normal text-left">{k}</th>
                <td className="px-4 py-2 tabular-nums">{a}</td>
                <td className="px-4 py-2 tabular-nums">{b}</td>
                <td className="px-4 py-2 tabular-nums font-semibold">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Runs <code>{c.off.run_id}</code> and <code>{c.on.run_id}</code>. {c.note}
      </p>
    </div>
  );
}

export function RunProvenance() {
  const runs = [EVALS.claude, EVALS.baseline].filter(Boolean) as RunSummary[];
  return (
    <ul className="text-xs text-muted-foreground space-y-1">
      {runs.map((r) => (
        <li key={r.run_id}>
          <code>{r.run_id}</code> · {r.client === "claude" ? r.model : "scripted baseline"} · commit {r.git_sha} ·{" "}
          {r.metrics.n_cases} cases · audit chain {r.audit_chain_valid ? "valid" : "INVALID"} · actions executed without
          approval: {r.actions_executed_without_approval}
          {r.via_gateway !== null && ` · ${r.via_gateway ? "via Secure AI Gateway" : "direct API"}`}
        </li>
      ))}
      {!EVALS.claude && <li>Claude evaluation: {NOT_MEASURED.toLowerCase()} — no published run yet.</li>}
    </ul>
  );
}

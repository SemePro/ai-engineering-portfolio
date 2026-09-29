import type { Metadata } from "next";
import Link from "next/link";
import { CachingResults, EvalResultsTable, RunProvenance } from "@/components/incident/eval-results";
import { EVALS, type CaseRow } from "@/lib/incident-data";
import { repoFile, repoPath } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Evaluation results — Incident Response Engine",
  description: "Measured root-cause accuracy, abstention, fault recovery, tool efficiency, cost, latency and prompt-caching impact.",
};

const KIND: Record<CaseRow["kind"], string> = {
  base: "Standard",
  abstain: "Evidence removed",
  fault: "Tool fault",
  runtime_fault: "Bad model output",
};

function CaseTable({ rows, label }: { rows: CaseRow[]; label: string }) {
  if (!rows.length) return <p className="text-sm italic text-muted-foreground">Not measured.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-muted/40 text-left">
          <tr>
            {["Case", "Type", "Result", "Predicted", "Conf.", "Action", "Tools", "Cost", "Time"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.case_id} className="border-t">
              <th scope="row" className="px-3 py-2 font-normal font-mono whitespace-nowrap text-left">
                <Link href={`/projects/incident-agent/trace?case=${r.case_id}`} className="hover:underline underline-offset-4">
                  {r.scenario_id.replace(/^inc-(\d+)-/, "$1 ")}
                </Link>
                {r.kind !== "base" && <span className="text-muted-foreground"> · {r.variant}</span>}
              </th>
              <td className="px-3 py-2 whitespace-nowrap">{KIND[r.kind]}</td>
              <td className={cn("px-3 py-2 font-medium", r.pass ? "text-emerald-400" : "text-red-400")}>
                {r.pass ? "pass" : "fail"}
                {r.fault_outcome && <span className="block font-normal text-muted-foreground">{r.fault_outcome.replaceAll("_", " ")}</span>}
              </td>
              <td className="px-3 py-2">
                {r.status === "root_cause_identified" ? `${r.predicted_category} · ${r.predicted_service}` : r.status.replaceAll("_", " ")}
              </td>
              <td className="px-3 py-2 tabular-nums">{r.confidence === null ? "—" : `${Math.round(r.confidence * 100)}%`}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.action_type?.replaceAll("_", " ") ?? "—"}{r.unsafe_proposals ? " ⚠" : ""}</td>
              <td className="px-3 py-2 tabular-nums">{r.tool_calls}{r.tool_errors ? ` (${r.tool_errors}✕)` : ""}</td>
              <td className="px-3 py-2 tabular-nums">${r.cost_usd.toFixed(3)}</td>
              <td className="px-3 py-2 tabular-nums">{(r.total_latency_ms / 1000).toFixed(1)}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EvalsPage() {
  const claudeRows = EVALS.cases.claude;
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <nav className="text-sm text-muted-foreground mb-4" aria-label="Breadcrumb">
        <Link href="/projects/incident-agent" className="hover:text-foreground">Incident Response Engine</Link> / Evaluation
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Evaluation results</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Numbers are copied from run artifacts, never typed in. Each run directory holds its config, one JSON trace per
        case, per-case grades and the summary shown here. Anything without a published run reads "Not measured".
      </p>

      <section className="mt-10" aria-labelledby="summary">
        <h2 id="summary" className="text-lg font-semibold mb-4">Summary</h2>
        <EvalResultsTable />
        <div className="mt-3"><RunProvenance /></div>
      </section>

      <section className="mt-12" aria-labelledby="caching">
        <h2 id="caching" className="text-lg font-semibold">Prompt caching: off vs on</h2>
        <p className="mt-2 mb-4 max-w-3xl text-sm text-muted-foreground">
          Tools and the system prompt form a byte-stable prefix shared by every investigation (a unit test enforces
          this); a second breakpoint caches the growing conversation turn over turn. Same incidents, run sequentially,
          caching off first.
        </p>
        <CachingResults />
      </section>

      <section className="mt-12" aria-labelledby="cases">
        <h2 id="cases" className="text-lg font-semibold mb-4">Per-case results{claudeRows.length ? " — Claude" : " — baseline"}</h2>
        <CaseTable rows={claudeRows.length ? claudeRows : EVALS.cases.baseline} label="Per-case results" />
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-2 text-sm" aria-labelledby="method">
        <div>
          <h2 id="method" className="text-lg font-semibold">Methodology</h2>
          <ul className="mt-3 space-y-2 text-muted-foreground list-disc pl-5">
            <li><b className="text-foreground font-medium">Root cause</b>: correct only if the category and the service both match ground truth.</li>
            <li><b className="text-foreground font-medium">Abstention</b>: on evidence-removed variants, pass only for <code>insufficient_evidence</code> and no proposal.</li>
            <li><b className="text-foreground font-medium">Faults</b>: pass if the agent recovers the right answer, or (where the scenario allows) stops safely. A wrong conclusion fails.</li>
            <li><b className="text-foreground font-medium">Tool efficiency</b>: read-tool calls per investigation vs a per-scenario minimum; identical repeat calls are counted as redundant.</li>
            <li><b className="text-foreground font-medium">Cost</b>: measured usage (input, output, cache read, cache write) × the price table version recorded in the run.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Reproduce</h2>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs"><code>{`cd incident-agent
pip install -e ".[dev]"
python -m incident_agent.evals.run --suite smoke   # no API key
export ANTHROPIC_API_KEY=...
python -m incident_agent.evals.run --suite full
python -m incident_agent.evals.run --suite caching
python -m incident_agent.evals.publish`}</code></pre>
          <p className="mt-3 text-muted-foreground">
            <a className="text-primary hover:underline underline-offset-4" href={repoFile("incident-agent/docs/EVALUATION.md")} target="_blank" rel="noopener noreferrer">Evaluation methodology</a>
            {" · "}
            <a className="text-primary hover:underline underline-offset-4" href={repoPath("incident-agent/src/incident_agent/lab/scenarios")} target="_blank" rel="noopener noreferrer">Dataset</a>
            {" · "}
            <a className="text-primary hover:underline underline-offset-4" href={repoPath("incident-agent/eval-results")} target="_blank" rel="noopener noreferrer">Run artifacts</a>
          </p>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="dataset">
        <h2 id="dataset" className="text-lg font-semibold mb-4">Dataset</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {EVALS.dataset.map((d) => (
            <li key={d.id} className="rounded-lg border p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-medium">{d.title}</h3>
                <span className="text-xs text-muted-foreground shrink-0">{d.difficulty}</span>
              </div>
              <p className="mt-1 text-xs font-mono text-muted-foreground">{d.alert.name} · {d.alert.service}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-primary">Ground truth & distractors</summary>
                <p className="mt-2 text-xs text-muted-foreground">{d.root_cause}</p>
                {d.distractors.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Distractors: {d.distractors.join("; ")}</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

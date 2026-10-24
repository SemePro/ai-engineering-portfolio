import type { Metadata } from "next";
import Link from "next/link";
import { TraceViewer } from "@/components/incident/trace-viewer";

export const metadata: Metadata = {
  title: "Replay an evaluation run — Incident Response Engine",
  description: "Replay recorded incident investigations step by step: tool calls, results, hypotheses, findings and proposals.",
};

export default function TracePage({ searchParams }: { searchParams: { case?: string } }) {
  const requested = searchParams.case && /^[a-z0-9_-]{1,120}$/.test(searchParams.case) ? searchParams.case : undefined;
  return (
    <div className="container mx-auto px-4 py-12">
      <nav className="text-sm text-muted-foreground mb-4" aria-label="Breadcrumb">
        <Link href="/projects/incident-agent" className="hover:text-foreground">Incident Response Engine</Link> / Trace
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Replay a reproducible agent evaluation run</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        These are recorded investigations from the evaluation harness, replayed step by step — not a live
        production agent. Each step is a structured event labelled by phase (observation, tool call, evidence,
        hypothesis, decision, recommendation, approval). The model's private reasoning is never requested, stored
        or shown; hypotheses are short summaries the agent publishes deliberately. Expand any step for arguments,
        tool output and token usage.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Replays cost nothing and are identical for every visitor. Live model runs are not offered on this site;
        the service's API supports them behind per-session, per-address and daily limits.
      </p>
      <div className="mt-8">
        <TraceViewer initialCase={requested} />
      </div>
    </div>
  );
}

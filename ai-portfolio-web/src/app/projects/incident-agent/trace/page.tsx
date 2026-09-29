import type { Metadata } from "next";
import Link from "next/link";
import { TraceViewer } from "@/components/incident/trace-viewer";

export const metadata: Metadata = {
  title: "Investigation trace — Incident Response Engine",
  description: "Replay recorded incident investigations step by step: tool calls, results, hypotheses, findings and proposals.",
};

export default function TracePage({ searchParams }: { searchParams: { case?: string } }) {
  const requested = searchParams.case && /^[a-z0-9_-]{1,120}$/.test(searchParams.case) ? searchParams.case : undefined;
  return (
    <div className="container mx-auto px-4 py-12">
      <nav className="text-sm text-muted-foreground mb-4" aria-label="Breadcrumb">
        <Link href="/projects/incident-agent" className="hover:text-foreground">Incident Response Engine</Link> / Trace
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Watch an investigation</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Recorded runs from the evaluation harness, replayed step by step. Each step is a structured event —
        tool requests, tool results, hypothesis updates, findings, proposals — not the model's private reasoning,
        which is never requested or stored. Expand any step for arguments, tool output and token usage.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Replays cost nothing. Live runs against the model are disabled on the public site; the API supports them
        behind per-session, per-address and daily limits.
      </p>
      <div className="mt-8">
        <TraceViewer initialCase={requested} />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleSlash,
  FileSearch,
  GitBranch,
  Lightbulb,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TraceEvent = {
  seq: number;
  t_ms: number;
  type: string;
  title: string;
  detail: Record<string, unknown>;
};

type Proposal = {
  id: string;
  action: string;
  args: Record<string, string>;
  risk: { level: string; impact: string; dependents: string[]; instances: number; tier: number };
  params_hash: string;
  status: string;
};

type Trace = {
  investigation_id: string;
  trace_id: string;
  scenario_id: string;
  variant: string;
  mode: string;
  caching: boolean;
  findings: {
    status: string;
    root_cause: { category: string; service: string; summary: string };
    confidence: number;
    missing_evidence: string[];
    recommended_action: { type: string; service: string; target_version: string; description: string };
    summary: string;
  } | null;
  findings_error: string | null;
  proposals: Proposal[];
  metrics: {
    model: string;
    model_calls: number;
    investigation_tool_calls: number;
    ledger_updates: number;
    tool_errors: number;
    tool_retries: number;
    usage: Record<string, number>;
    cost_usd: number;
    total_latency_ms: number;
    model_latency_ms: number;
  };
  trace: TraceEvent[];
};

type IndexEntry = {
  case_id: string;
  title: string;
  difficulty: string;
  kind: string;
  variant: string;
  pass: boolean;
  status: string;
  tool_calls: number;
  cost_usd: number;
  source: string;
  run_id: string;
};

const KIND_LABEL: Record<string, string> = {
  base: "Standard incidents",
  abstain: "Critical evidence removed",
  fault: "Tool failures injected",
  runtime_fault: "Malformed model output injected",
};

const STYLE: Record<string, { icon: typeof Bot; className: string }> = {
  alert: { icon: AlertTriangle, className: "text-red-400" },
  model_call: { icon: Bot, className: "text-primary" },
  tool_call: { icon: FileSearch, className: "text-emerald-400" },
  tool_result: { icon: CheckCircle2, className: "text-emerald-400/80" },
  tool_error: { icon: XCircle, className: "text-red-400" },
  hypotheses: { icon: Lightbulb, className: "text-sky-300" },
  proposal: { icon: GitBranch, className: "text-amber-400" },
  findings: { icon: ShieldCheck, className: "text-foreground" },
  approval: { icon: ShieldAlert, className: "text-amber-400" },
  guardrail: { icon: CircleSlash, className: "text-orange-400" },
  budget: { icon: CircleSlash, className: "text-orange-400" },
  error: { icon: XCircle, className: "text-red-400" },
};

function clock(base: string, offsetMs: number) {
  const d = new Date(new Date(base).getTime() + 3 * 60_000 + offsetMs);
  return d.toISOString().slice(11, 19);
}

function DetailView({ ev }: { ev: TraceEvent }) {
  const d = ev.detail as Record<string, any>;
  if (ev.type === "model_call") {
    return (
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
        {[
          ["stop", d.stop_reason],
          ["latency", `${d.latency_ms} ms`],
          ["input", d.input_tokens],
          ["output", d.output_tokens],
          ["cache read", d.cache_read_tokens],
          ["cache write", d.cache_write_tokens],
          ["cost", `$${Number(d.cost_usd).toFixed(4)}`],
          ["request", d.request_id || "—"],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono break-all">{String(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (ev.type === "hypotheses") {
    return (
      <ul className="space-y-1 text-xs">
        {(d.hypotheses as any[]).map((h) => (
          <li key={h.id} className="flex gap-2">
            <span className="font-mono text-muted-foreground w-8 shrink-0">{h.id}</span>
            <span className={cn("w-20 shrink-0", h.status === "ruled_out" ? "text-muted-foreground line-through" : h.status === "supported" ? "text-emerald-400" : "")}>
              {h.status}
            </span>
            <span className="font-mono w-10 shrink-0">{Math.round(h.confidence * 100)}%</span>
            <span>{h.statement}</span>
          </li>
        ))}
        {d.next_step && <li className="text-muted-foreground pt-1">Next: {d.next_step}</li>}
      </ul>
    );
  }
  const shown: Record<string, unknown> = { ...d };
  const preview = shown.preview as string | undefined;
  delete shown.preview;
  return (
    <div className="space-y-2">
      {Object.keys(shown).length > 0 && (
        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">{JSON.stringify(shown, null, 2)}</pre>
      )}
      {preview && (
        <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/40 rounded p-2 max-h-64 overflow-auto">{preview}</pre>
      )}
    </div>
  );
}

export function TraceViewer({ initialCase }: { initialCase?: string }) {
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [source, setSource] = useState<string>("");
  const [selected, setSelected] = useState<string>(initialCase ?? "");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/incident-agent/traces/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        setIndex(j.traces);
        setSource(j.source);
        if (!initialCase && j.traces.length) {
          const preferred = j.traces.find((t: IndexEntry) => t.case_id.startsWith("inc-01") && t.kind === "base");
          setSelected((preferred ?? j.traces[0]).case_id);
        }
      })
      .catch(() => setError("Could not load recorded traces."));
  }, [initialCase]);

  useEffect(() => {
    if (!selected) return;
    setTrace(null);
    setPlaying(false);
    fetch(`/incident-agent/traces/${selected}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((t: Trace) => {
        setTrace(t);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setShown(reduce ? t.trace.length : 1);
        setPlaying(!reduce);
      })
      .catch(() => setError("Could not load this trace."));
  }, [selected]);

  const events = useMemo(() => trace?.trace ?? [], [trace]);
  const done = shown >= events.length;

  const step = useCallback(() => setShown((n) => Math.min(n + 1, events.length)), [events.length]);

  useEffect(() => {
    if (!playing || done) {
      if (done) setPlaying(false);
      return;
    }
    const next = events[shown];
    const delay = next?.type === "model_call" ? 750 : next?.type === "findings" ? 900 : 420;
    timer.current = setTimeout(step, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, shown, done, events, step]);

  const grouped = useMemo(() => {
    const g: Record<string, IndexEntry[]> = {};
    (index ?? []).forEach((e) => {
      (g[e.kind] ??= []).push(e);
    });
    return g;
  }, [index]);

  const alertTime = (events[0]?.detail?.fired_at as string) ?? "";
  const entry = index?.find((e) => e.case_id === selected);
  const pending = trace?.proposals ?? [];

  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <label htmlFor="trace-select" className="text-sm text-muted-foreground shrink-0">
            Incident
          </label>
          <select
            id="trace-select"
            className="w-full sm:w-auto min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {Object.entries(grouped).map(([kind, items]) => (
              <optgroup key={kind} label={KIND_LABEL[kind] ?? kind}>
                {items.map((i) => (
                  <option key={i.case_id} value={i.case_id}>
                    {i.title}
                    {i.kind !== "base" ? ` — ${i.variant.replaceAll("_", " ")}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => (done ? (setShown(1), setPlaying(true)) : setPlaying((p) => !p))}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              disabled={!trace}
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {playing ? "Pause" : done ? "Replay" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setShown(events.length);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              disabled={!trace || done}
            >
              <SkipForward className="h-4 w-4" aria-hidden /> Show all
            </button>
          </div>
        </div>

        {source === "baseline" && (
          <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
            These traces come from the scripted fixed-playbook baseline (no LLM). Claude runs appear here once the
            evaluation has been run and published.
          </p>
        )}

        <ol className="relative space-y-1 border-l border-border pl-5" aria-live="polite">
          {events.slice(0, shown).map((ev) => {
            const s = STYLE[ev.type] ?? STYLE.tool_result;
            const Icon = s.icon;
            const expandable = Object.keys(ev.detail ?? {}).length > 0 && ev.type !== "alert";
            return (
              <li key={ev.seq} className="relative">
                <span className="absolute -left-[27px] top-2 rounded-full bg-background p-0.5">
                  <Icon className={cn("h-4 w-4", s.className)} aria-hidden />
                </span>
                <details className="group rounded-md px-2 py-1.5 hover:bg-muted/30 open:bg-muted/30">
                  <summary className={cn("flex gap-3 text-sm list-none", expandable ? "cursor-pointer" : "cursor-default")}>
                    <time className="font-mono text-xs text-muted-foreground pt-0.5 shrink-0 tabular-nums">
                      {alertTime ? clock(alertTime, ev.t_ms) : `+${(ev.t_ms / 1000).toFixed(1)}s`}
                    </time>
                    <span className={cn("min-w-0 break-words", ev.type === "findings" && "font-semibold")}>
                      {ev.title}
                    </span>
                  </summary>
                  {expandable && (
                    <div className="mt-2 ml-0 sm:ml-16">
                      <DetailView ev={ev} />
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
        {!trace && !error && <p className="text-sm text-muted-foreground">Loading trace…</p>}
      </div>

      <aside className="space-y-4 text-sm" aria-label="Investigation summary">
        {trace && (
          <>
            <section className="rounded-lg border p-4">
              <h3 className="font-semibold mb-2">Run</h3>
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-mono break-all">{trace.metrics.model}</dd>
                <dt className="text-muted-foreground">Model calls</dt>
                <dd>{trace.metrics.model_calls}</dd>
                <dt className="text-muted-foreground">Tool calls</dt>
                <dd>
                  {trace.metrics.investigation_tool_calls}
                  {trace.metrics.tool_errors ? ` (${trace.metrics.tool_errors} failed)` : ""}
                </dd>
                <dt className="text-muted-foreground">Tokens in / out</dt>
                <dd className="font-mono">
                  {(trace.metrics.usage.input_tokens + trace.metrics.usage.cache_read_input_tokens + trace.metrics.usage.cache_creation_input_tokens).toLocaleString()} /{" "}
                  {trace.metrics.usage.output_tokens.toLocaleString()}
                </dd>
                <dt className="text-muted-foreground">Cache read</dt>
                <dd className="font-mono">{trace.metrics.usage.cache_read_input_tokens.toLocaleString()}</dd>
                <dt className="text-muted-foreground">Cost</dt>
                <dd className="font-mono">${trace.metrics.cost_usd.toFixed(4)}</dd>
                <dt className="text-muted-foreground">Wall time</dt>
                <dd className="font-mono">{(trace.metrics.total_latency_ms / 1000).toFixed(1)}s</dd>
                <dt className="text-muted-foreground">Trace ID</dt>
                <dd className="font-mono break-all">{trace.trace_id.slice(0, 16)}…</dd>
              </dl>
              {entry && (
                <p className={cn("mt-3 text-xs font-medium", entry.pass ? "text-emerald-400" : "text-red-400")}>
                  Graded: {entry.pass ? "pass" : "fail"} ({entry.kind === "abstain" ? "should abstain" : entry.kind === "base" ? "root cause + action" : "fault handling"})
                </p>
              )}
            </section>

            {done && trace.findings && (
              <section className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">Findings</h3>
                <p className="text-xs mb-2">
                  <span className="text-muted-foreground">Status: </span>
                  {trace.findings.status.replaceAll("_", " ")} · {Math.round(trace.findings.confidence * 100)}% confidence
                </p>
                {trace.findings.root_cause.summary && <p className="text-xs mb-2">{trace.findings.root_cause.summary}</p>}
                {trace.findings.missing_evidence.length > 0 && (
                  <p className="text-xs text-muted-foreground">Missing: {trace.findings.missing_evidence.join("; ")}</p>
                )}
                <p className="text-xs mt-2">
                  <span className="text-muted-foreground">Recommended: </span>
                  {trace.findings.recommended_action.type.replaceAll("_", " ")}
                  {trace.findings.recommended_action.description ? ` — ${trace.findings.recommended_action.description}` : ""}
                </p>
              </section>
            )}
            {done && !trace.findings && (
              <section className="rounded-lg border border-red-500/40 p-4 text-xs">
                <h3 className="font-semibold mb-1">No conclusion reported</h3>
                <p className="text-muted-foreground">{trace.findings_error}</p>
              </section>
            )}

            {done && pending.map((p) => (
              <section key={p.id} className="rounded-lg border border-amber-500/50 p-4">
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-400" aria-hidden /> Awaiting approval
                </h3>
                <p className="text-xs font-mono mb-2 break-all">
                  {p.action}({Object.entries(p.args).filter(([k]) => k !== "reason").map(([k, v]) => `${k}=${v}`).join(", ")})
                </p>
                <p className="text-xs"><span className="text-muted-foreground">Risk: </span>{p.risk.level} · tier {p.risk.tier} · {p.risk.instances} instances</p>
                <p className="text-xs text-muted-foreground mt-1">{p.risk.impact}</p>
                {p.risk.dependents.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Dependents: {p.risk.dependents.join(", ")}</p>
                )}
                <p className="text-xs mt-2 font-mono text-muted-foreground break-all">params_hash {p.params_hash.slice(0, 16)}…</p>
                <p className="text-xs mt-3 text-muted-foreground">
                  Executes only after <code>POST /actions/{"{id}"}/approve</code> with an operator token scoped to this
                  service and the matching params hash. Eval runs never approve.
                </p>
              </section>
            ))}
          </>
        )}
      </aside>
    </div>
  );
}

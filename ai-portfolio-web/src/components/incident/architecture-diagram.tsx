/**
 * Incident agent architecture. Desktop: SVG. Small screens: the same flow as
 * stacked blocks (an SVG this wide is unreadable at phone width).
 */

type BoxProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines?: string[];
  tone?: "default" | "model" | "read" | "write" | "muted";
};

const TONE: Record<NonNullable<BoxProps["tone"]>, string> = {
  default: "fill-card stroke-border",
  model: "fill-primary/10 stroke-primary/60",
  read: "fill-emerald-500/10 stroke-emerald-500/50",
  write: "fill-amber-500/10 stroke-amber-500/60",
  muted: "fill-muted/40 stroke-border",
};

function Box({ x, y, w, h, title, lines = [], tone = "default" }: BoxProps) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} className={TONE[tone]} strokeWidth={1.25} />
      <text x={x + 12} y={y + 21} className="fill-foreground" fontSize={13} fontWeight={600}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 12} y={y + 39 + i * 16} className="fill-muted-foreground" fontSize={11}>
          {l}
        </text>
      ))}
    </g>
  );
}

function Arrow({ d, label, lx, ly, tone = "default" }: { d: string; label?: string; lx?: number; ly?: number; tone?: "default" | "write" }) {
  const stroke = tone === "write" ? "stroke-amber-500/80" : "stroke-muted-foreground/70";
  return (
    <g>
      <path d={d} fill="none" className={stroke} strokeWidth={1.4} markerEnd={tone === "write" ? "url(#arrow-w)" : "url(#arrow)"} />
      {label && lx !== undefined && ly !== undefined && (
        <text x={lx} y={ly} className="fill-muted-foreground" fontSize={10.5} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

export function ArchitectureDiagram() {
  return (
    <figure className="w-full">
      <div className="hidden md:block">
        <svg
          viewBox="0 0 1040 600"
          className="w-full h-auto"
          role="img"
          aria-labelledby="arch-title arch-desc"
        >
          <title id="arch-title">Incident agent architecture</title>
          <desc id="arch-desc">
            An alert starts the incident agent. The agent calls Claude through the Secure AI Gateway, queries read-only
            observability tools directly, and can only propose write actions, which pass through a server-side approval
            gate before sandboxed execution. Traces, token accounting and the evaluation harness surround the system.
          </desc>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground/80" />
            </marker>
            <marker id="arrow-w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-amber-500" />
            </marker>
          </defs>

          <rect x={6} y={6} width={1028} height={588} rx={12} fill="none" className="stroke-border" strokeDasharray="4 5" />

          <Box x={24} y={64} w={150} h={84} title="Alert" lines={["SEV2 · checkout-api", "p99 latency > 800ms"]} />
          <Arrow d="M174,106 L214,106" />

          <Box x={214} y={28} w={300} h={262} title="Incident Agent" lines={["FastAPI · manual tool-use loop"]} />
          <Box x={230} y={82} w={268} h={40} title="Investigate → hypothesise → decide" tone="muted" />
          <Box x={230} y={130} w={268} h={40} title="Tool executor: allowlist + validation" tone="muted" />
          <Box x={230} y={178} w={268} h={40} title="Budgets: turns · tools · $ · wall time" tone="muted" />
          <Box x={230} y={226} w={268} h={40} title="Trace + hypothesis ledger (no raw CoT)" tone="muted" />

          <Arrow d="M514,112 L596,112" label="Messages API" lx={555} ly={102} />
          <Box
            x={596}
            y={52}
            w={196}
            h={168}
            title="Secure AI Gateway"
            lines={["service-key auth", "rate limit · daily $ budget", "PII redaction (tool output)", "timeouts · bounded retries", "token + cache accounting", "audit log with trace_id"]}
          />
          <Arrow d="M792,136 L830,136" />
          <Box
            x={830}
            y={82}
            w={186}
            h={108}
            title="Claude"
            tone="model"
            lines={["claude-opus-5-5", "strict tool schemas", "structured final output", "prompt caching"]}
          />
          <text x={923} y={210} className="fill-muted-foreground" fontSize={10.5} textAnchor="middle">
            provider key held only by gateway
          </text>

          <text x={24} y={336} className="fill-emerald-500" fontSize={11} fontWeight={600} letterSpacing={0.5}>
            READ TOOLS · executed directly · read-only
          </text>
          <Arrow d="M364,290 L364,350" />
          {["Logs", "Metrics", "Changes", "Health", "Incident KB"].map((t, i) => (
            <Box key={t} x={24 + i * 98} y={350} w={90} h={48} title={t} tone="read" />
          ))}

          <text x={568} y={336} className="fill-amber-500" fontSize={11} fontWeight={600} letterSpacing={0.5}>
            WRITE TOOLS · proposal only
          </text>
          <Arrow d="M514,258 L540,258 L540,374 L568,374" tone="write" />
          <Box x={568} y={350} w={138} h={52} title="Proposal" lines={["rollback · restart"]} tone="write" />
          <Arrow d="M706,376 L732,376" tone="write" />
          <Box
            x={732}
            y={336}
            w={170}
            h={96}
            title="Approval gate"
            tone="write"
            lines={["human + signed token", "role · env · service scope", "params hash · 15-min expiry"]}
          />
          <Arrow d="M902,376 L924,376" tone="write" />
          <Box x={924} y={350} w={96} h={52} title="Execute" lines={["sandbox"]} tone="write" />
          <Arrow d="M817,432 L817,452" tone="write" />
          <Box x={732} y={452} w={288} h={42} title="Hash-chained audit log" lines={[]} tone="muted" />

          <rect x={24} y={516} width={996} height={62} rx={8} className="fill-muted/30 stroke-border" strokeWidth={1} />
          <text x={40} y={539} className="fill-foreground" fontSize={12} fontWeight={600}>
            Observability · cost controls · evaluation · audit
          </text>
          <text x={40} y={560} className="fill-muted-foreground" fontSize={11}>
            trace_id agent → gateway · tokens + $ per call · run budgets (calls, tools, $, time) + gateway daily $ cap ·
            gateway + approval audit logs · 14-incident eval harness · CI gate
          </text>
        </svg>
      </div>

      <ol className="md:hidden space-y-2 text-sm" aria-label="Incident agent architecture">
        {[
          { t: "Alert", d: "SEV2 · checkout-api p99 latency", c: "border-border" },
          { t: "Incident Agent", d: "Tool-use loop, validated tool executor, budgets, structured trace", c: "border-border" },
          { t: "Secure AI Gateway", d: "Auth, $ budget, PII redaction, retries, token accounting, audit", c: "border-border" },
          { t: "Claude", d: "claude-opus-5-5 · strict tools · structured output · caching", c: "border-primary/60" },
          { t: "Read tools (direct)", d: "Logs · metrics · change history · health · incident KB", c: "border-emerald-500/50" },
          { t: "Write tools → proposal", d: "Rollback / restart are never executed by the agent", c: "border-amber-500/60" },
          { t: "Approval gate", d: "Human + signed token, scope, params hash, expiry → sandbox → audit log", c: "border-amber-500/60" },
          { t: "Around everything", d: "Tracing, budgets (per run + per service), audit logs, eval harness, CI gate", c: "border-border" },
        ].map((s, i) => (
          <li key={s.t} className={`rounded-md border ${s.c} bg-card px-3 py-2`}>
            <span className="font-mono text-xs text-muted-foreground mr-2">{i + 1}</span>
            <span className="font-medium">{s.t}</span>
            <p className="text-muted-foreground text-xs mt-0.5">{s.d}</p>
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">Incident agent architecture diagram</figcaption>
    </figure>
  );
}

import { repoFile, repoPath } from "@/lib/profile";
import { cn } from "@/lib/utils";

type Item = { capability: string; status: "Implemented" | "Partial" | "Not implemented"; evidence: string; href: string };

const ITEMS: Item[] = [
  { capability: "Agentic tool use", status: "Implemented", evidence: "Model-chosen tool calls over 6 read tools", href: repoFile("incident-agent/src/incident_agent/agent.py") },
  { capability: "Human approval, server-enforced", status: "Implemented", evidence: "Signed token, scope, params hash, expiry — covered by tests", href: repoFile("incident-agent/tests/test_approvals.py") },
  { capability: "Evaluation suite", status: "Implemented", evidence: "14 incidents + abstention + fault variants", href: repoPath("incident-agent/src/incident_agent/evals") },
  { capability: "Failure injection", status: "Implemented", evidence: "500, timeout, missing, malformed, partial, stale, bad model output", href: repoFile("incident-agent/src/incident_agent/faults.py") },
  { capability: "Cost & token accounting", status: "Implemented", evidence: "Per call, incl. cache reads/writes; gateway budget", href: repoFile("secure-ai-gateway/src/llm_proxy.py") },
  { capability: "Tracing", status: "Partial", evidence: "Structured trace + trace_id to gateway audit; no OpenTelemetry export yet", href: repoFile("incident-agent/docs/ARCHITECTURE.md") },
  { capability: "Security controls", status: "Implemented", evidence: "Allowlist, strict schemas, PII redaction, injection test", href: repoFile("incident-agent/docs/SAFETY.md") },
  { capability: "CI regression gate", status: "Implemented", evidence: "No-LLM smoke eval on every PR; capped Claude eval on demand", href: repoFile(".github/workflows/pr-checks.yml") },
];

export function Scorecard() {
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {ITEMS.map((i) => (
        <li key={i.capability} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-2.5">
          <span className="sm:w-60 font-medium">{i.capability}</span>
          <span
            className={cn(
              "w-fit rounded px-2 py-0.5 text-xs font-medium",
              i.status === "Implemented" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            )}
          >
            {i.status}
          </span>
          <a href={i.href} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground sm:ml-auto sm:text-right text-xs underline-offset-4 hover:underline">
            {i.evidence}
          </a>
        </li>
      ))}
    </ul>
  );
}

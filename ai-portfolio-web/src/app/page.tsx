import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArchitectureDiagram } from "@/components/incident/architecture-diagram";
import { EvalResultsTable } from "@/components/incident/eval-results";
import { ContactLinks } from "@/components/contact-links";
import { DATASET_STATS, EVALS, pct } from "@/lib/incident-data";
import { PROFILE, repoPath } from "@/lib/profile";

const focus = [
  "Agentic systems",
  "LLM infrastructure",
  "AI evaluation",
  "Secure AI gateways",
  "RAG",
  "Human-in-the-loop",
  "Reliability engineering",
];

const platform = [
  {
    name: "Secure AI Gateway",
    role: "Shared platform layer",
    text: "Every model call goes through it: service-key auth, per-service $ budgets, PII redaction, retries, token and cache accounting, audit log.",
    href: repoPath("secure-ai-gateway"),
    demo: "/demo/gateway",
  },
  {
    name: "LLM Evaluation Harness",
    role: "Quality gates",
    text: "Regression suites for LLM outputs with deterministic checks, run in CI before changes ship.",
    href: repoPath("llm-eval-harness"),
    demo: "/demo/eval",
  },
  {
    name: "RAG Knowledge Assistant",
    role: "Grounded answers",
    text: "Retrieval with citations and a strict mode that refuses when retrieval confidence is low.",
    href: repoPath("rag-knowledge-assistant"),
    demo: "/demo/rag",
  },
  {
    name: "Incident Investigator v1",
    role: "Predecessor to the agent",
    text: "Single-pass RAG over a fixed evidence bundle. Its limits — no ability to go look for missing evidence — motivated the agentic rebuild.",
    href: repoPath("ai-incident-investigator"),
    demo: "/projects/incident",
  },
  {
    name: "DevOps Risk Analysis",
    role: "Decision support",
    text: "Pre-deploy change risk scoring against historical incidents, with a human making the call.",
    href: repoPath("ai-devops-control-plane"),
    demo: "/projects/devops",
  },
  {
    name: "Architecture Review Assistant",
    role: "Decision support",
    text: "Structured architecture recommendations with trade-offs, including when not to use AI.",
    href: repoPath("ai-solution-architecture-review"),
    demo: "/projects/architecture",
  },
];

const principles = [
  ["Measure before optimizing.", "Prompt caching went in with an on/off experiment, not an assumption."],
  ["Models recommend; authorization stays deterministic.", "The agent can propose a rollback. Only a signed, scoped, unexpired operator approval can run one."],
  ["Uncertainty should be visible.", "“Insufficient evidence” is a first-class outcome, and it is graded."],
  ["Every agent needs an evaluation strategy.", "Known-ground-truth incidents, deterministic graders, a baseline to beat, thresholds in CI."],
  ["Failures are test cases, not surprises.", "Tool outages, malformed data and bad model output are injected on purpose."],
];

const skills = [
  { group: "Agentic AI", items: ["Tool use", "Agent loops & budgets", "Human-in-the-loop approval", "Structured outputs", "Context management"] },
  { group: "LLM engineering", items: ["Claude / Anthropic API", "OpenAI API", "Prompt caching", "RAG & embeddings", "ChromaDB"] },
  { group: "AI platform", items: ["FastAPI", "AI gateway design", "AuthN/Z for agents", "Rate limits & cost controls", "PII redaction"] },
  { group: "Evaluation & reliability", items: ["LLM evals", "Failure injection", "Regression gates", "Deterministic fixtures", "Playwright & Cypress"] },
  { group: "Delivery", items: ["Python", "TypeScript / Next.js", "Docker", "GitHub Actions CI", "Railway & Vercel"] },
];

export default function Home() {
  const claude = EVALS.claude;
  return (
    <div className="flex flex-col">
      {/* Identity */}
      <section className="border-b">
        <div className="container mx-auto px-4 pt-16 pb-14 md:pt-24 md:pb-20">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-muted-foreground">{PROFILE.name}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl md:leading-[1.1]">
              Senior AI Engineer building reliable agentic and production AI systems.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl">
              I design, evaluate and operate LLM systems: agents with real tool use, a shared AI gateway, and the
              evaluation and failure-injection harnesses that decide whether they can be trusted. Before AI, a decade
              in quality engineering, automation and platform reliability.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Focus areas">
              {focus.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <Link
                href="/projects/incident-agent"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                See the flagship project
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <ContactLinks />
            </div>
          </div>
        </div>
      </section>

      {/* Flagship */}
      <section className="border-b" aria-labelledby="flagship">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Flagship</p>
              <h2 id="flagship" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Agentic Incident Response Engine
              </h2>
              <p className="mt-4 text-muted-foreground">
                Given an alert, a Claude-based agent decides what to look at — logs, metrics, change history, service
                health, past incidents — forms and revises hypotheses, and reports a root cause with a confidence, or
                says the evidence isn't enough. It can propose a rollback or restart; it cannot execute one. That takes
                a human approval the backend verifies.
              </p>
            </div>
            <div className="lg:pt-8">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs">Root-cause accuracy</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {claude ? pct(claude.metrics.root_cause_accuracy) : <span className="text-base italic text-muted-foreground font-normal">Not measured yet</span>}
                  </dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs">Fixed-playbook baseline</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{pct(EVALS.baseline?.metrics.root_cause_accuracy ?? null)}</dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs">Synthetic incidents</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{DATASET_STATS.scenarios}</dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs">Abstention + fault variants</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{DATASET_STATS.abstainVariants + DATASET_STATS.faultVariants}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link href="/projects/incident-agent" className="font-medium text-primary hover:underline underline-offset-4">Case study →</Link>
                <Link href="/projects/incident-agent/trace" className="font-medium text-primary hover:underline underline-offset-4">Replay an evaluation run →</Link>
                <Link href="/projects/incident-agent/evals" className="font-medium text-primary hover:underline underline-offset-4">Eval results →</Link>
                <a href={repoPath("incident-agent")} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">
                  Code →<span className="sr-only"> (opens in new tab)</span>
                </a>
              </div>
            </div>
          </div>
          <div className="mt-12 min-w-0">
            <ArchitectureDiagram />
          </div>
        </div>
      </section>

      {/* Evidence */}
      <section className="border-b bg-muted/20" aria-labelledby="evidence">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl">
            <h2 id="evidence" className="text-xl font-semibold tracking-tight">Measured, not claimed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every number below comes from a reproducible run in <code>incident-agent/eval-results/</code>.
              Anything not yet measured says so.
            </p>
          </div>
          <div className="mt-6 max-w-4xl">
            <EvalResultsTable compact />
          </div>
        </div>
      </section>

      {/* Platform */}
      <section className="border-b" aria-labelledby="platform">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl">
            <h2 id="platform" className="text-xl font-semibold tracking-tight">One platform, not six demos</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              AI applications → Secure AI Gateway → model providers. The other systems share the same gateway,
              evaluation and testing practices.
            </p>
          </div>
          <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {platform.map((p) => (
              <li key={p.name} className="bg-background p-5">
                <p className="text-xs text-muted-foreground">{p.role}</p>
                <h3 className="mt-1 font-medium">{p.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
                <div className="mt-3 flex gap-4 text-xs">
                  <Link href={p.demo} className="text-primary hover:underline underline-offset-4">Details</Link>
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                    Code<span className="sr-only"> (opens in new tab)</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Principles + skills */}
      <section className="border-b" aria-labelledby="principles">
        <div className="container mx-auto px-4 py-16 grid gap-12 lg:grid-cols-2">
          <div>
            <h2 id="principles" className="text-xl font-semibold tracking-tight">Engineering principles</h2>
            <dl className="mt-6 space-y-4">
              {principles.map(([p, e]) => (
                <div key={p}>
                  <dt className="font-medium">{p}</dt>
                  <dd className="text-sm text-muted-foreground mt-0.5">{e}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Skills</h2>
            <dl className="mt-6 space-y-4">
              {skills.map((s) => (
                <div key={s.group}>
                  <dt className="text-sm font-medium">{s.group}</dt>
                  <dd className="text-sm text-muted-foreground mt-0.5">{s.items.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section aria-labelledby="contact">
        <div className="container mx-auto px-4 py-14 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h2 id="contact" className="text-xl font-semibold tracking-tight">Hiring for AI engineering?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Senior AI Engineer · Applied AI · AI Platform · Agent engineering roles.
            </p>
          </div>
          <ContactLinks />
        </div>
      </section>
    </div>
  );
}

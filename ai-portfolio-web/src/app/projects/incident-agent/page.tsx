import type { Metadata } from "next";
import Link from "next/link";
import { ArchitectureDiagram } from "@/components/incident/architecture-diagram";
import { EvalResultsTable, RunProvenance } from "@/components/incident/eval-results";
import { Scorecard } from "@/components/incident/scorecard";
import { DATASET_STATS, EVALS, pct } from "@/lib/incident-data";
import { repoFile, repoPath } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Agentic Incident Response Engine — case study",
  description:
    "A Claude-based incident investigation agent with read-only tools, server-enforced human approval for operational actions, a synthetic incident lab and an evaluation harness.",
};

const loop = [
  ["Alert", "The only input. No evidence bundle is pre-assembled."],
  ["Observe", "Health, metric overviews, error groups, change history — the model picks."],
  ["Hypothesise", "Published to the on-call engineer via update_hypotheses: statement, status, confidence, cited tool calls."],
  ["Gather evidence", "Narrow queries to confirm or rule out; follow dependencies upstream."],
  ["Continue or stop", "Stops when evidence explains timing and mechanism, or budgets run out."],
  ["Conclude", "Structured findings: root cause + confidence, or insufficient_evidence with what is missing."],
  ["Recommend", "Write tools create a proposal with risk and blast radius. Nothing executes."],
  ["Approve", "A human with a scoped operator token approves the exact params hash; the backend executes in a sandbox and audits."],
];

const decisions: { q: string; a: React.ReactNode }[] = [
  {
    q: "Why Claude for the incident agent?",
    a: (
      <>
        The job needs reliable multi-step tool use with schema-exact arguments, a machine-readable final answer in the
        same request as tool use, and a large static prefix (tools + instructions) reused on every turn. Claude supports
        all three directly: strict tool schemas, structured outputs alongside tools, and prompt caching. Adaptive
        thinking with an explicit <code>effort</code> gives one knob for depth vs cost. The choice is made on these
        requirements; the eval harness talks to a client interface, so the model can be re-evaluated with numbers
        rather than opinions.
      </>
    ),
  },
  {
    q: "Why a hand-written loop instead of the SDK tool runner?",
    a: (
      <>
        The loop has to own four things: turning write-tool calls into proposals instead of executions, emitting a
        trace event per step, enforcing hard budgets (model calls, tool calls, dollars, wall time), and repairing an
        invalid final answer once before failing safe. Those are the safety-relevant parts, so they live in code that is
        read and tested directly (<a className="underline" href={repoFile("incident-agent/src/incident_agent/agent.py")} target="_blank" rel="noopener noreferrer">agent.py</a>).
      </>
    ),
  },
  {
    q: "Why human approval for operational writes?",
    a: (
      <>
        A rollback on a tier-1 service has a blast radius measured in customers. A wrong one — rolling back the service
        that alerted when the cause is two hops upstream, which several scenarios are built around — makes the incident
        worse. Approval adds minutes to a remediation; a wrong autonomous action can add hours. The approval is enforced
        by the backend (signed token, role, environment and service scope, params hash, expiry), so neither a prompt
        injection nor a UI bug can bypass it.
      </>
    ),
  },
  {
    q: "Why not fully autonomous remediation?",
    a: (
      <>
        Autonomy should be earned per action class with evidence. The harness already measures whether proposals are
        appropriate; a reasonable next step would be auto-approving only low-blast-radius actions (e.g. restarting a
        tier-3 worker when a past incident documents that remedy) after the measured unsafe-proposal rate stays at zero
        over a meaningful sample. The model is never the security boundary either way.
      </>
    ),
  },
  {
    q: "Why synthetic incidents?",
    a: (
      <>
        Known ground truth makes grading exact; seeded noise makes runs reproducible; no production data leaves any
        system; and each scenario can carry deliberate distractors (a nearby but unrelated deploy, a symptom that looks
        like a cause) plus variants with critical evidence removed or tools broken. Real postmortems would add realism
        but not ground truth you can grade against automatically.
      </>
    ),
  },
  {
    q: "Why route model calls through the Secure AI Gateway?",
    a: (
      <>
        The agent holds only a gateway service key; the provider key never leaves the gateway. Budgets, PII redaction
        of tool output, retries, timeouts, token/cost accounting and the audit trail are then platform policy shared by
        every AI app instead of being re-implemented per project. The agent uses the official Anthropic SDK with
        <code> base_url</code> pointed at the gateway, so application code does not change between direct and gateway
        mode.
      </>
    ),
  },
  {
    q: "Why FastAPI?",
    a: (
      <>
        Consistency with the six existing services, and Pydantic models used end to end: tool argument validation,
        the findings contract, trace events and API bodies are the same types. The service does little CPU work; it
        waits on the model, so a simple thread-per-investigation model is enough at this scale.
      </>
    ),
  },
  {
    q: "Why a hypothesis ledger instead of showing the model's reasoning?",
    a: (
      <>
        Raw reasoning is not requested, stored or displayed. The agent instead publishes short structured hypotheses
        (statement, status, confidence, cited tool calls) through a side-effect-free tool. That is what an on-call
        engineer actually needs, it is auditable, and it costs a few hundred tokens per update.
      </>
    ),
  },
];

const tradeoffs = [
  "No streaming through the gateway yet: simpler accounting and redaction; the UI polls a run instead.",
  "Keyword search over the incident knowledge base, not embeddings: 5–10 postmortems per scenario don't need a vector store.",
  "Rate limits, budgets and approvals are single-instance (in-memory / SQLite). Correct for one replica; Redis/Postgres for more.",
  "Observability backends are simulated in-process, so measured tool latency is not representative of real Loki/Prometheus calls.",
  "Deterministic graders only. No LLM-as-judge: every scenario has structured ground truth, so there is nothing to judge fuzzily.",
  "Public demo replays recorded runs; live model runs from the site are off by default to keep cost bounded.",
];

const demonstrates: [string, string][] = [
  ["Agentic tool use, not one-shot prompting", "The model chooses which of 6 read tools to call and when to stop; nothing is pre-assembled."],
  ["Evidence-driven conclusions", "Findings must cite tool-call ids; citations that don't match a successful call are flagged."],
  ["Human-in-the-loop operational safety", "Write tools only create proposals; execution is authorized by the backend, not the model."],
  ["Evaluation against known ground truth", "14 incidents with structured answers, deterministic graders, and a no-LLM baseline."],
  ["Failure injection and recovery testing", "500s, timeouts, missing, malformed, partial and stale data, and invalid model output."],
  ["Prompt-injection resistance", "A hostile instruction planted in logs; measured on every evaluation run."],
  ["Cost and latency measurement", "Per-call tokens (incl. cache reads/writes), dollars and latency, with hard budgets."],
  ["Secure model access through a shared gateway", "Provider key only in the gateway; per-service auth, budgets, PII redaction, audit."],
  ["Reproducible runs", "Every published number links to a run with its config, versions and per-case traces."],
];

const next: [string, string][] = [
  ["Distributed state", "Rate limits, spend ledgers and run state move from process memory to Redis; approvals and audit move from SQLite to Postgres with row-level locking on proposal state."],
  ["Asynchronous workers", "Alerts land on a queue (e.g. SQS/Kafka); investigations run in background workers with idempotency keys, so a retried alert never starts two investigations or proposes twice."],
  ["Real telemetry backends", "Prometheus, Loki and the deploy system behind the same tool contracts, with per-tool timeouts, pagination and result-size budgets."],
  ["Identity and RBAC", "Operators authenticate through the company IdP (OIDC); approval rights come from on-call schedules and service ownership. Services use workload identity instead of shared keys."],
  ["Event-driven execution", "Approved actions go to the deployment system as change requests (Argo/Spinnaker), which enforces its own policy and emits the outcome back into the trace."],
  ["OpenTelemetry", "Export model and tool calls as spans with GenAI semantic conventions so investigations appear in the same tracing backend as the services they investigate."],
  ["Incident data privacy", "Redact before storage as well as before the model; retention limits on traces; tenant isolation for multi-team deployments."],
  ["Larger evaluation corpus", "Sanitised real postmortems, per-incident-class accuracy, repeated runs for variance, and regression gates on the classes that matter."],
  ["Provider and region redundancy", "A second provider or region behind the gateway for availability — kept out of benchmarks, which must name one model."],
];

export default function IncidentAgentCaseStudy() {
  const claude = EVALS.claude;
  return (
    <article className="container mx-auto px-4 py-12 md:py-16">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Case study · flagship</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Agentic Incident Response Engine</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          An AI SRE agent that investigates alerts with real tool use, knows when evidence is insufficient, and can only
          recommend operational actions that a human approves.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/projects/incident-agent/trace" className="font-medium text-primary hover:underline underline-offset-4">Replay an evaluation run →</Link>
          <Link href="/projects/incident-agent/evals" className="font-medium text-primary hover:underline underline-offset-4">Full eval results →</Link>
          <a href={repoPath("incident-agent")} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">Code & docs →</a>
        </div>
      </header>

      <div className="mt-12 grid gap-14 max-w-5xl">
        <section aria-labelledby="demonstrates">
          <h2 id="demonstrates" className="text-xl font-semibold">What this project demonstrates</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
            {demonstrates.map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="problem">
          <h2 id="problem" className="text-xl font-semibold">Problem</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-muted-foreground">
            <p>
              During an incident, the first 15 minutes go to gathering context: which service is actually broken, what
              changed, whether this has happened before. The alerting service is often just where the symptom shows up.
            </p>
            <p>
              Handing an LLM a pre-assembled bundle of "relevant" logs (what the v1 investigator did) assumes someone
              already knows where to look. The useful version has to decide what to look at, notice what is missing, and
              stop short of guessing — and it must not be able to change production on its own.
            </p>
          </div>
        </section>

        <section aria-labelledby="architecture">
          <h2 id="architecture" className="text-xl font-semibold">Architecture</h2>
          <div className="mt-5">
            <ArchitectureDiagram />
          </div>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2">
            {loop.map(([t, d], i) => (
              <li key={t} className="flex gap-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground pt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="font-medium">{t}.</span> <span className="text-muted-foreground">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="decisions">
          <h2 id="decisions" className="text-xl font-semibold">Engineering decisions</h2>
          <div className="mt-4 divide-y rounded-lg border">
            {decisions.map((d) => (
              <details key={d.q} className="group px-4 py-3">
                <summary className="cursor-pointer font-medium text-sm list-none flex justify-between gap-4">
                  {d.q}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{d.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="safety">
          <h2 id="safety" className="text-xl font-semibold">Safety and reliability</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2 text-sm">
            <div>
              <h3 className="font-medium">The model is never the security boundary</h3>
              <ul className="mt-2 space-y-1.5 text-muted-foreground list-disc pl-5">
                <li>Read and write tools are separate classes. Write tools only create proposals.</li>
                <li>Tool allowlist; strict JSON schemas at the API and Pydantic validation again in the executor.</li>
                <li>Proposals are re-validated against the environment (rollback target must be a recorded previous version).</li>
                <li>Execution requires a signed operator token with the right role, environment and service scope, the exact params hash, and an unexpired proposal. Tested for each refusal path.</li>
                <li>Every state change goes to a hash-chained audit log; tampering is detectable.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium">Failing safe</h3>
              <ul className="mt-2 space-y-1.5 text-muted-foreground list-disc pl-5">
                <li>Budgets on model calls, tool calls, dollars and wall time; at the limit the agent must conclude without tools.</li>
                <li>Tool errors return to the model as errors; transient timeouts retry once at the transport layer.</li>
                <li>Invalid final output gets one repair attempt, then the run reports no conclusion rather than a guess.</li>
                <li>Log content is treated as untrusted data; one scenario plants an instruction to roll back an unrelated service.</li>
                <li>Gateway outages and budget exhaustion stop the run with a recorded reason.</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-sm">
            <a href={repoFile("incident-agent/docs/SAFETY.md")} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
              Full safety model →
            </a>
          </p>
        </section>

        <section aria-labelledby="evaluation">
          <h2 id="evaluation" className="text-xl font-semibold">Evaluation</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            {DATASET_STATS.scenarios} synthetic incidents with known root causes and distractors, {DATASET_STATS.abstainVariants}{" "}
            variants with the critical evidence removed, and {DATASET_STATS.faultVariants} tool-failure variants, plus
            malformed-model-output cases. Graders are deterministic. A fixed-playbook baseline with no LLM runs on the
            same cases, so the agent has something concrete to beat.
          </p>
          <div className="mt-5">
            <EvalResultsTable />
          </div>
          <div className="mt-3">
            <RunProvenance />
          </div>
        </section>

        <section aria-labelledby="results">
          <h2 id="results" className="text-xl font-semibold">Measured results</h2>
          <div className="mt-3 max-w-3xl text-sm text-muted-foreground space-y-2">
            {claude ? (
              <p>
                On the latest published run ({claude.metrics.n_cases} cases, {claude.model}), root-cause accuracy was{" "}
                {pct(claude.metrics.root_cause_accuracy)} against {pct(EVALS.baseline?.metrics.root_cause_accuracy ?? null)} for the
                baseline. Details, per-case results and the caching experiment are on the{" "}
                <Link href="/projects/incident-agent/evals" className="text-primary underline-offset-4 hover:underline">results page</Link>.
              </p>
            ) : (
              <p>
                The Claude evaluation has not been published yet, so its numbers read "Not measured". The fixed-playbook
                baseline has been measured: it finds the root cause in{" "}
                {pct(EVALS.baseline?.metrics.root_cause_accuracy ?? null)} of standard incidents, mostly by blaming the most
                recent change — which the distractors are designed to punish.
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="scorecard">
          <h2 id="scorecard" className="text-xl font-semibold">Capability scorecard</h2>
          <p className="mt-2 text-sm text-muted-foreground">Factual status with a link to the evidence, not a rating.</p>
          <div className="mt-4">
            <Scorecard />
          </div>
        </section>

        <section aria-labelledby="tradeoffs">
          <h2 id="tradeoffs" className="text-xl font-semibold">Trade-offs: what I chose not to do</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5 max-w-3xl">
            {tradeoffs.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>

        <section aria-labelledby="at-scale">
          <h2 id="at-scale" className="text-xl font-semibold">What I would change at scale</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">None of this is implemented; it is where the current design would go next.</p>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
            {next.map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </article>
  );
}

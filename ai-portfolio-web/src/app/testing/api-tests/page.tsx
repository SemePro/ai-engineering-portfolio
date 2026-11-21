import { TestingAreaNav } from "@/components/testing/testing-area-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Testing",
  description:
    "Contract and response validation: health, schemas, error paths, and predictability for gateway-backed services.",
};

const focusAreas = [
  {
    title: "Health",
    body: "Liveness and readiness-style checks on the Secure AI Gateway and downstream services (RAG, Eval, Incident, DevOps).",
  },
  {
    title: "Schema shape",
    body: "Response bodies match expected keys and types—critical when Pydantic models or OpenAI payloads evolve.",
  },
  {
    title: "Error handling",
    body: "4xx/5xx paths, validation errors, and gateway rejections (rate limit, injection) return stable, parseable errors.",
  },
  {
    title: "Latency expectations",
    body: "Upper-bound assertions on cold vs warm paths; separate budgets for embedding-heavy vs chat routes.",
  },
  {
    title: "Response consistency",
    body: "Deterministic fields (request_id, metadata) present; AI text may vary but envelope is stable.",
  },
];

export default function APITestsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <TestingAreaNav />
        <Badge variant="secondary" className="mb-4">
          Contract & behavior
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">API testing</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-10">
          API tests focus on contracts, schemas, and failure modes. They
          validate that the gateway and services respond with expected shape and
          status. Fast signal before UI or integration runs.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">What is covered</h2>
          <div className="space-y-4">
            {focusAreas.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border/80 bg-muted/10 p-4"
              >
                <h3 className="font-medium text-sm mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-2">What is not covered / tradeoffs</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Exhaustive fuzzing, load testing at scale, or testing every
            combination of request parameters. Tradeoffs: prioritizing
            contract and error-path predictability over full combinatorial
            coverage; production smoke stays read-only (e.g. health only).
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Connection to portfolio systems</CardTitle>
            <CardDescription>
              Same services described on Architecture and Projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              The gateway fronts RAG retrieval, LLM evaluation, incident
              investigation, DevOps risk analysis, and architecture review. API
              tests assert that each route behind the gateway still accepts
              valid input and returns structured JSON—including citation blocks,
              eval scores, and gateway metadata.
            </p>
            <p>
              Contract tests per service and negative cases (missing API keys,
              validation errors) are in scope. Local execution targets Docker
              Compose; production smoke stays minimal and read-only.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

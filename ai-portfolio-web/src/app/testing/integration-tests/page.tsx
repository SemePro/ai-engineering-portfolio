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
  title: "Integration Testing",
  description:
    "System-level validation: frontend through gateway to backend, dependencies, and failure modes.",
};

const layers = [
  {
    title: "Frontend to gateway",
    body: "Browser or API client hits the same origins and paths the deployed app uses—no bypassing the gateway in happy path.",
  },
  {
    title: "Gateway to backend service",
    body: "Routing, auth headers, and middleware execute; requests reach RAG, Eval, Incident, or DevOps as intended.",
  },
  {
    title: "UI rendering of service responses",
    body: "After a real (or staged) call, the UI shows loading, success, and structured results—tables, citations, errors.",
  },
  {
    title: "Graceful fallback / error states",
    body: "When services timeout or return errors, users see clear messaging—not infinite spinners or raw stack traces.",
  },
];

export default function IntegrationTestsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <TestingAreaNav />
        <Badge variant="secondary" className="mb-4">
          System paths
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Integration testing
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-10">
          Integration tests focus on system behavior: frontend through gateway
          to backend, including dependencies and failure modes. They validate
          that the system behaves correctly when components work together, not
          only in isolation.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-6">
            What is covered
          </h2>
          <div className="space-y-4">
            {layers.map((layer, i) => (
              <div key={layer.title} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-medium">{layer.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {layer.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-2">What is not covered / tradeoffs</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Full chaos or failure-injection testing, or exercising every
            dependency combination. Tradeoffs: balancing test speed vs depth;
            production smoke is intentionally narrow to avoid impacting live
            systems.
          </p>
        </section>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Run modes: local vs production smoke</CardTitle>
            <CardDescription>
              Different environments, different risk profiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              <span className="text-foreground font-medium">Local execution </span>
              runs against Docker Compose with full stack and optional test data.
              Suites can exercise real LLM calls (guarded by keys and quotas)
              or stubbed responses for speed. This is where most integration
              depth lives before merge.
            </p>
            <p>
              <span className="text-foreground font-medium">Production smoke </span>
              is intentionally narrow: health, a few read-only or low-risk
              checks, and synthetic monitoring-style probes. It confirms
              deploys did not break wiring; it does not replace deep regression.
            </p>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          Runnable integration specs (e.g. RAG error UI, eval shell when
          backend unreachable) are implemented. See the Testing overview for
          suite commands (<code className="text-xs bg-muted px-1 rounded">npm run test:integration</code>).
        </p>
      </div>
    </div>
  );
}

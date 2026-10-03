import Link from "next/link";
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
  title: "Automation Testing",
  description:
    "Automation strategy: smoke, regression, critical workflows, and confidence gating.",
};

export default function AutomationTestingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <TestingAreaNav />
        <Badge variant="secondary" className="mb-4">
          Automation strategy
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Automation testing
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-12">
          Automation is organized in layers: fast smoke locally, deeper
          regression in CI, and read-only production smoke. Each mode serves a
          distinct purpose.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Run modes</h2>
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            <Card className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Local full suite</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Complete validation before merge: Playwright, Cypress, API,
                  integration. Dev server starts automatically.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Production smoke</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Safe, read-only checks against the live site. Scheduled
                  nightly; results on <Link href="/testing/reports" className="text-primary hover:underline">Reports</Link>.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">How automation is organized</h2>
          <ul className="space-y-4 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Smoke — </span>
              Minimal path checks after build: critical routes render, gateway
              health responds, no obvious breakage.{" "}
              <Badge variant="outline" className="ml-1 text-xs">
                local + CI
              </Badge>
            </li>
            <li>
              <span className="text-foreground font-medium">Regression — </span>
              Broader suites that cover demos, API contracts, and integration
              paths. Run on merge and release candidates.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Critical workflows —{" "}
              </span>
              User-visible journeys (RAG query, eval dashboard, gateway
              playground) that must never silently break.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Confidence gating —{" "}
              </span>
              Tests block promotion when assertions fail; flaky tests are fixed
              or quarantined—not ignored.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Coverage layers</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "UI",
                body: "Navigation, layout, and key interactions in the Next.js app.",
              },
              {
                title: "API",
                body: "Gateway and service endpoints: shape, status codes, and error paths.",
              },
              {
                title: "Integration",
                body: "Browser or harness through gateway to real or stubbed backends.",
              },
            ].map((c) => (
              <Card key={c.title} className="bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{c.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">
            Testing and AI reliability
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            LLM-backed services are non-deterministic. Automation validates
            structure, latency, and failure modes; eval pipelines track output
            quality. Together they reduce surprise when models or prompts
            change. Tradeoffs include balancing test speed vs depth.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>How automation fits into CI/CD and AI evaluation</CardTitle>
            <CardDescription>
              One pipeline mindset: code, models, and prompts all need gates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="text-foreground font-medium">CI/CD — </span>
              Commits trigger lint, typecheck, unit checks where applicable, then
              UI/API/integration tiers. Release branches can add longer runs or
              nightly full regression.
            </p>
            <p>
              <span className="text-foreground font-medium">AI evaluation — </span>
              The eval service and automated suites are documented under
              projects; automation ensures the app and gateway still serve those
              flows. Planned coverage includes wiring eval smoke into the same
              promotion gates as the web tier.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

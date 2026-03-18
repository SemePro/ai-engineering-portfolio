import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bot,
  Layers,
  MonitorSmartphone,
  Network,
  TestTube2,
  Workflow,
} from "lucide-react";
import type { Metadata } from "next";
import {
  TESTING_LANDING_CARDS,
  type TestingLandingIconId,
} from "@/lib/testing-nav";
import { ImplementationStatus } from "@/components/testing/implementation-status";

const LANDING_ICONS: Record<
  TestingLandingIconId,
  typeof Workflow
> = {
  workflow: Workflow,
  monitor: MonitorSmartphone,
  testTube: TestTube2,
  layers: Layers,
  network: Network,
  bot: Bot,
};

export const metadata: Metadata = {
  title: "Testing | Applied AI Engineering Portfolio",
  description:
    "Testing as part of system reliability: UI, API, and integration validation with production smoke and AI-assisted tooling.",
};

const philosophy = [
  {
    title: "System reliability",
    body: "Testing is part of keeping the portfolio and its AI-backed flows predictable. Confidence is built before deployment.",
  },
  {
    title: "Engineering discipline",
    body: "Tests are maintained like production code: intentional, tied to real risk, and validated in CI.",
  },
  {
    title: "Safe AI integration",
    body: "Validation gates apply to code, prompts, and integration points. AI is used as a support tool, not a replacement for deterministic checks.",
  },
  {
    title: "Production-minded validation",
    body: "Production smoke (read-only) complements local and CI regression. Tradeoffs include prioritizing reliability over exhaustive coverage.",
  },
];

const howToRead = [
  { tool: "Playwright", body: "UI and reliability checks: rendering, navigation, deterministic assertions. Strong browser coverage and stability." },
  { tool: "Cypress", body: "User flows and interaction testing. Focus on developer feedback and journey-style specs." },
  { tool: "API tests", body: "Contract and response validation: health, schemas, error paths. Fast signal before UI runs." },
  { tool: "Integration tests", body: "System-level validation: frontend through gateway to backend, including failure modes." },
  { tool: "AI-assisted workflow", body: "CLI tools for suggesting cases, triaging failures, and gap analysis. Improves coverage and debugging; all outputs are reviewed before use." },
];

const aiWorkflow = [
  {
    title: "Suggesting additional test cases",
    body: "Candidate cases and edge paths from specs and existing suites; review before merge.",
  },
  {
    title: "Summarizing failures",
    body: "Traces and logs summarized to speed root-cause analysis when CI or smoke runs fail.",
  },
  {
    title: "Identifying gaps",
    body: "Untested routes and API surfaces mapped against the architecture to prioritize backlog work.",
  },
];

export default function TestingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4">
            Portfolio extension
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Testing</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Testing is part of system reliability. It supports safe AI
            integration and builds confidence before deployment. AI is used as
            a support tool in the workflow—not a replacement for deterministic
            validation.
          </p>
        </div>

        <ImplementationStatus />

        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-4">How to read this section</h2>
          <ul className="space-y-3 text-sm text-muted-foreground mb-10 max-w-3xl">
            {howToRead.map((item) => (
              <li key={item.tool}>
                <span className="text-foreground font-medium">{item.tool} — </span>
                {item.body}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6">Philosophy</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {philosophy.map((item) => (
              <Card key={item.title} className="bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground leading-relaxed max-w-3xl">
            The sections below describe how validation is organized: what is
            implemented today and what is planned. Focus is on clarity and
            system-level thinking, not exhaustive coverage.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6">Areas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {TESTING_LANDING_CARDS.map((area) => {
              const Icon = LANDING_ICONS[area.icon];
              return (
                <Card
                  key={area.href}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg">{area.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {area.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button variant="ghost" size="sm" className="px-0" asChild>
                      <Link href={area.href}>
                        Read more
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-4">Run modes</h2>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <Card className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Local full suite</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Complete validation: Playwright, Cypress, API, and integration
                  tests. Dev server starts automatically. Use before merge or
                  release.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Production smoke</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Safe, read-only checks against the live site. No form posts or
                  destructive calls. Run on schedule or manually; results on{" "}
                  <Link href="/testing/reports" className="text-primary hover:underline">Reports</Link>.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-4">AI in the testing workflow</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
            AI is used for: suggesting additional test cases, summarizing
            failures, and identifying potential gaps. AI is not used for:
            blindly generating tests, replacing deterministic validation, or
            making deployment decisions. All AI-assisted outputs are reviewed
            and validated before use.
          </p>
          <div className="space-y-3">
            {aiWorkflow.map((item) => (
              <div
                key={item.title}
                className="border-l-2 border-primary/40 pl-4 py-1"
              >
                <h3 className="font-medium text-sm">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Card className="bg-muted/30">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Test infrastructure and CI are implemented; this section documents
              design and coverage.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/architecture">System architecture</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

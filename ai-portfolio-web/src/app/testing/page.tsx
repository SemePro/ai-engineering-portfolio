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

export const metadata: Metadata = {
  title: "Testing | Applied AI Engineering Portfolio",
  description:
    "Automation, UI, API, and integration testing as part of a reliability-first engineering workflow.",
};

const areas = [
  {
    href: "/testing/automation",
    title: "Automation Testing",
    description:
      "Smoke, regression, and critical workflows with confidence gating across the stack.",
    icon: Workflow,
  },
  {
    href: "/testing/playwright",
    title: "Playwright",
    description:
      "Cross-browser UI coverage, tracing, and resilient selectors for the Next.js portfolio.",
    icon: MonitorSmartphone,
  },
  {
    href: "/testing/cypress",
    title: "Cypress",
    description:
      "E2E journeys, API interception, and fast feedback on user flows and demos.",
    icon: TestTube2,
  },
  {
    href: "/testing/ui-tests",
    title: "UI Testing",
    description:
      "Header, layout, responsive rendering, and route-level UI validation.",
    icon: Layers,
  },
  {
    href: "/testing/api-tests",
    title: "API Testing",
    description:
      "Health, schema shape, errors, and consistency for gateway-backed AI services.",
    icon: Network,
  },
  {
    href: "/testing/integration-tests",
    title: "Integration Testing",
    description:
      "Frontend through gateway to backend: end-to-end system behavior and fallbacks.",
    icon: Bot,
  },
];

const philosophy = [
  {
    title: "Engineering discipline",
    body: "Tests are treated as production code: maintainable, intentional, and tied to real risk.",
  },
  {
    title: "Confidence before change",
    body: "Local and CI checks establish a baseline so refactors and model updates ship with evidence.",
  },
  {
    title: "Production-minded validation",
    body: "Production smoke and staged checks complement deep regression suites.",
  },
  {
    title: "AI-assisted workflows",
    body: "LLMs support expansion and triage; human judgment keeps scope and assertions trustworthy.",
  },
];

const aiWorkflow = [
  {
    title: "AI-assisted test expansion",
    body: "Generate candidate cases and edge paths from specs and existing suites; review before merge.",
  },
  {
    title: "Failure triage support",
    body: "Summarize traces and logs to speed root-cause analysis when CI or smoke runs fail.",
  },
  {
    title: "Gap analysis",
    body: "Map untested routes and API surfaces against the architecture to prioritize backlog work.",
  },
  {
    title: "Smoke check prioritization",
    body: "Rank minimal must-pass checks for fast feedback on every change.",
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
            Automation, UI, API, and integration testing integrated into a
            reliability-first engineering workflow.
          </p>
        </div>

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
            This portfolio treats testing as part of applied AI engineering:
            reliable gateways, eval services, and RAG pipelines only matter if
            changes are validated systematically. The sections below describe how
            that validation is organized—what is{" "}
            <span className="text-foreground font-medium">implemented</span> today
            and what is{" "}
            <span className="text-foreground font-medium">planned coverage</span>{" "}
            for Phase 2.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6">Areas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {areas.map((area) => (
              <Card
                key={area.href}
                className="group hover:bg-muted/30 transition-colors"
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <area.icon className="h-5 w-5 text-primary" />
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
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">
            AI in the testing workflow
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
            AI augments how tests are written and interpreted—it does not replace
            clear assertions or ownership of quality. High-level uses:
          </p>
          <div className="space-y-4">
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
              Test infrastructure and CI wiring land in Phase 2; this section
              documents intent and coverage design.
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

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
  title: "Cypress | Applied AI Engineering Portfolio",
  description:
    "Cypress for E2E workflow validation, API interception, and developer-friendly debugging.",
};

const strengths = [
  {
    title: "E2E workflow validation",
    body: "Full user journeys through the SPA with readable specs and time-travel UI.",
  },
  {
    title: "API interception",
    body: "Stub or assert on network calls—useful for gateway responses and error simulations.",
  },
  {
    title: "Debugging experience",
    body: "Screenshots, video, and command log make local iteration fast.",
  },
  {
    title: "Fast feedback loop",
    body: "Interactive runner during development; headless runs in CI.",
  },
];

const coverageAreas = [
  "User flows across demos",
  "Navigation journeys",
  "Route content validation",
  "Demo interactions (forms, buttons, results)",
];

const coverageRows = [
  { area: "Core nav + footer links", status: "planned" as const },
  { area: "Demo: RAG / eval / gateway", status: "planned" as const },
  { area: "Demo: incident / DevOps / architecture", status: "planned" as const },
  { area: "Error and empty states (intercepted API)", status: "planned" as const },
];

export default function CypressPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <TestingAreaNav />
        <Badge variant="secondary" className="mb-4">
          E2E tooling
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Cypress</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-10">
          Cypress complements Playwright for scenarios where its developer
          experience and network stubbing shine—especially journey-style tests
          and rapid local debugging on the same codebase.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Why Cypress</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Not every team runs both Cypress and Playwright; this portfolio
            documents both to show breadth. Cypress is strong for interactive
            demo pages and for validating UI against controlled API responses.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {strengths.map((s) => (
              <Card key={s.title} className="bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Sample coverage areas</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {coverageAreas.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b bg-primary/5">
            <CardTitle>Planned / implemented coverage</CardTitle>
            <CardDescription>
              Distinct visual treatment from Playwright; same Phase 2 rollout.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-sm">
                <caption className="sr-only">
                  Cypress planned and implemented coverage by area
                </caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Area
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium w-36">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coverageRows.map((row) => (
                    <tr key={row.area} className="border-b border-border/60">
                      <td className="px-4 py-3">{row.area}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">Planned coverage</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

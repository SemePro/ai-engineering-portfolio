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
    "Cypress for user flows and interaction testing with a strong developer feedback loop.",
};

const strengths = [
  {
    title: "User flows and interaction",
    body: "Full user journeys through the app with readable specs. Validates that key flows work end-to-end.",
  },
  {
    title: "Developer feedback loop",
    body: "Interactive runner during development; screenshots, video, and command log make local iteration fast. Headless runs in CI.",
  },
  {
    title: "API interception",
    body: "Stub or assert on network calls—useful for gateway responses and error simulations. Planned extension for more coverage.",
  },
  {
    title: "Time-travel debugging",
    body: "Inspect state at each step when a spec fails. Complements Playwright tracing with a different workflow.",
  },
];

const coverageAreas = [
  "User flows across demos",
  "Navigation journeys",
  "Route content validation",
  "Demo interactions (forms, buttons, results)",
];

const coverageRows: { area: string; status: "implemented" | "planned" }[] = [
  { area: "Journeys: home → demos → projects", status: "implemented" },
  { area: "Testing hub + return home", status: "implemented" },
  { area: "Footer consistency (multi-page)", status: "implemented" },
  { area: "Contact / footer consistency", status: "implemented" },
  { area: "Prod smoke (read-only)", status: "implemented" },
  { area: "API intercept / error UI (planned extension)", status: "planned" },
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
          Cypress is focused on user flows and interaction testing. Its
          developer experience and interactive runner support a fast feedback
          loop during development; headless runs feed into CI and production
          smoke.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Focus: user flows and feedback</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Cypress is used for journey-style specs and validating that
            interactions work as expected. The focus is on readable tests and
            quick iteration when debugging, not on replacing Playwright’s
            cross-browser or tracing strengths.
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
          <h2 className="text-xl font-semibold mb-4">What is covered</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {coverageAreas.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-2">Tradeoffs</h2>
          <p className="text-sm text-muted-foreground">
            Running both Cypress and Playwright adds maintenance; the tradeoff is
            breadth of tooling and different strengths (flows vs.
            cross-browser stability). Production smoke uses a minimal subset
            for speed.
          </p>
        </section>

        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b bg-primary/5">
            <CardTitle>Planned / implemented coverage</CardTitle>
            <CardDescription>
              Cypress e2e specs under <code className="text-xs">cypress/e2e/</code>.
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
                        <Badge
                          variant={
                            row.status === "implemented" ? "default" : "secondary"
                          }
                        >
                          {row.status === "implemented"
                            ? "Implemented"
                            : "Planned"}
                        </Badge>
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

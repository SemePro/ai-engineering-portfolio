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
  title: "Playwright",
  description:
    "Playwright for reliable UI testing: rendering, deterministic checks, and cross-browser coverage.",
};

const strengths = [
  {
    title: "Reliability and stability",
    body: "Deterministic checks with auto-waiting reduce flakiness around hydration and async content. Suites run consistently in CI and locally.",
  },
  {
    title: "Cross-browser coverage",
    body: "Chromium, WebKit, and Firefox from one suite. Validates rendering and behavior across browsers.",
  },
  {
    title: "Tracing",
    body: "Time-travel debugging when a check fails. Artifacts support root-cause analysis without repro.",
  },
  {
    title: "Resilient selectors",
    body: "Role- and text-based locators align with accessible, stable markup. Fewer brittle DOM selectors.",
  },
];

const coverageAreas = [
  "Navigation smoke",
  "Page rendering",
  "Route validation",
  "Content checks",
  "Responsive UI checks",
];

const coverageRows: { area: string; status: "implemented" | "planned" }[] = [
  { area: "Home & static pages", status: "implemented" },
  { area: "Demo routes (RAG, eval, gateway, …)", status: "implemented" },
  { area: "Projects & architecture docs", status: "implemented" },
  { area: "Testing section & subpages", status: "implemented" },
  { area: "Contact / footer consistency", status: "implemented" },
  { area: "Mobile + desktop (local)", status: "implemented" },
];

export default function PlaywrightPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <TestingAreaNav />
        <Badge variant="secondary" className="mb-4">
          Browser automation
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Playwright</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-10">
          Playwright is used for reliability-focused UI testing: rendering
          checks, deterministic assertions, and cross-browser coverage. It pairs
          well with Next.js App Router and server-rendered content.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Focus: reliability and rendering</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            The suite is designed for stability and browser coverage. Tests
            validate that pages render, navigation works, and key content is
            present—without depending on non-deterministic behavior.
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
          <h2 className="text-xl font-semibold mb-2">What is not covered</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Exhaustive visual regression, load testing at scale, or destructive
            production testing. Tradeoffs: prioritizing reliability and speed
            over full pixel-perfect or stress coverage.
          </p>
        </section>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Planned / implemented coverage</CardTitle>
            <CardDescription>
              Status reflects current coverage. Specs under{" "}
              <code className="text-xs">tests/playwright/</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-sm">
                <caption className="sr-only">
                  Playwright coverage by area
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

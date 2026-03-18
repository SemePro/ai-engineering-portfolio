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
  title: "UI Testing | Applied AI Engineering Portfolio",
  description:
    "Visual and layout correctness: navigation, responsive rendering, and page integrity.",
};

const pageMatrix = [
  {
    page: "Home",
    headerNav: "planned",
    layout: "planned",
    responsive: "planned",
    links: "planned",
  },
  {
    page: "Projects",
    headerNav: "planned",
    layout: "planned",
    responsive: "planned",
    links: "planned",
  },
  {
    page: "Demos",
    headerNav: "planned",
    layout: "planned",
    responsive: "planned",
    links: "planned",
  },
  {
    page: "Architecture",
    headerNav: "planned",
    layout: "planned",
    responsive: "planned",
    links: "planned",
  },
  {
    page: "Testing",
    headerNav: "planned",
    layout: "planned",
    responsive: "planned",
    links: "planned",
  },
  {
    page: "About",
    headerNav: "planned",
    layout: "planned",
    responsive: "planned",
    links: "planned",
  },
  {
    page: "Contact",
    headerNav: "planned",
    layout: "planned",
    responsive: "planned",
    links: "planned",
  },
] as const;

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className="text-xs font-normal">
      {status === "planned" ? "Planned" : "Implemented"}
    </Badge>
  );
}

export default function UITestsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <TestingAreaNav />
        <Badge variant="secondary" className="mb-4">
          Presentation layer
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">UI testing</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-10">
          UI tests focus on visual and layout correctness and page integrity:
          structure, navigation, and key regions render as intended. They
          anchor the shell around demos and docs; they do not replace API or
          integration tests.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">What is covered</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Header / nav — </span>
              Active states, logo link, top-level routes including Testing.
            </li>
            <li>
              <span className="text-foreground font-medium">Page layout — </span>
              Main regions render; no blank critical sections on load.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Responsive rendering —{" "}
              </span>
              Breakpoint smoke: nav collapse, readable content, tap targets.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Buttons and links —{" "}
              </span>
              Internal routes resolve; external links (e.g. GitHub) use correct
              targets.
            </li>
            <li>
              <span className="text-foreground font-medium">Key routes — </span>
              Contact, about, projects, demo entry, and architecture pages load
              without client errors.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-2">What is not covered</h2>
          <p className="text-sm text-muted-foreground">
            Exhaustive visual regression (pixel diff), load testing, or
            third-party widget behavior. Tradeoffs: prioritizing layout and
            navigation correctness over full screenshot coverage.
          </p>
        </section>

        <Card className="overflow-x-auto">
          <CardHeader>
            <CardTitle>Covered page types</CardTitle>
            <CardDescription>
              Matrix of UI dimensions by page family. Status reflects design;
              implementation varies by area (see Playwright and Cypress pages for
              current coverage).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-4">
            <div className="hidden md:block min-w-[640px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Page type</th>
                    <th className="px-4 py-3 font-medium">Header / nav</th>
                    <th className="px-4 py-3 font-medium">Layout</th>
                    <th className="px-4 py-3 font-medium">Responsive</th>
                    <th className="px-4 py-3 font-medium">Links / CTAs</th>
                  </tr>
                </thead>
                <tbody>
                  {pageMatrix.map((row) => (
                    <tr key={row.page} className="border-b border-border/60">
                      <td className="px-4 py-3 font-medium">{row.page}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.headerNav} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.layout} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.responsive} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.links} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden grid gap-3 px-4">
              {pageMatrix.map((row) => (
                <Card key={row.page} className="bg-muted/20">
                  <CardHeader className="py-3 pb-2">
                    <CardTitle className="text-base">{row.page}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Header / nav</span>
                      <StatusBadge status={row.headerNav} />
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Layout</span>
                      <StatusBadge status={row.layout} />
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Responsive</span>
                      <StatusBadge status={row.responsive} />
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Links / CTAs</span>
                      <StatusBadge status={row.links} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

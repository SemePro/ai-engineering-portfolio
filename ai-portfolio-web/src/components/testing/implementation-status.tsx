import { testSuiteMeta } from "@/lib/test-suite-meta";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ImplementationStatus() {
  return (
    <section className="mb-16">
      <h2 className="text-xl font-semibold mb-2">Implemented test infrastructure</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
        Phase 2 adds runnable Playwright, Cypress, Vitest API checks, and AI-assisted
        CLI utilities. Production smoke is read-only (GET navigations only).
      </p>

      <div className="grid gap-4 md:grid-cols-2 mb-10">
        {testSuiteMeta.runModes.map((m) => (
          <Card key={m.id} className="bg-muted/15">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{m.name}</CardTitle>
                <Badge variant="secondary">{m.id}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{m.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-lg font-semibold mb-4">Suites</h3>
      <div className="space-y-4 mb-10">
        {testSuiteMeta.suites.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{s.name}</CardTitle>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-1.5">
                {s.areas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto text-muted-foreground">
                {s.commands.join("\n")}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-lg font-semibold mb-4">AI-assisted workflow (CLI)</h3>
      <div className="rounded-lg border border-border/80 bg-muted/10 p-4 space-y-3 text-sm">
        {testSuiteMeta.aiWorkflow.map((w) => (
          <div key={w.name}>
            <span className="font-medium">{w.name}</span>
            <code className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
              {w.command}
            </code>
            <p className="text-muted-foreground mt-1">{w.detail}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Requires <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code>{" "}
          for suggest/triage/gap narrative. Outputs under{" "}
          <code className="bg-muted px-1 rounded">tests/reports/</code> — always
          human-reviewed before acting.
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <h3 className="text-lg font-semibold mb-1">Live production report</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {testSuiteMeta.scheduledReport.note} View{" "}
          <a
            href={testSuiteMeta.scheduledReport.page}
            className="text-primary font-medium hover:underline"
          >
            Test reports
          </a>
          .
        </p>
      </div>
    </section>
  );
}

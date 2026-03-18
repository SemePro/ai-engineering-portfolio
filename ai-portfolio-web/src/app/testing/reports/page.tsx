import { TestingAreaNav } from "@/components/testing/testing-area-nav";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadTestReport, type TestReportData } from "@/lib/load-test-report";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  Cloud,
  HardDrive,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Test reports | Applied AI Engineering Portfolio",
  description:
    "Nightly production smoke test results for semefit.com — updated every night via GitHub Actions.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function ReportsBody({
  data,
  source,
}: {
  data: TestReportData;
  source: string;
}) {
  const pw = data.playwright;
  const isPlaceholder =
    data.placeholder === true ||
    (pw.total === 0 && data.generatedAt?.startsWith("1970"));

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <TestingAreaNav />

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Badge variant="secondary">Nightly run</Badge>
          {source === "remote" && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Cloud className="h-3 w-3" />
              Live from repo
            </Badge>
          )}
          {source === "local" && (
            <Badge variant="outline" className="gap-1 font-normal">
              <HardDrive className="h-3 w-3" />
              Local file
            </Badge>
          )}
          {data.overallOk === true && !isPlaceholder && (
            <Badge className="bg-emerald-600/90 hover:bg-emerald-600">
              All green
            </Badge>
          )}
          {data.overallOk === false && !isPlaceholder && (
            <Badge variant="destructive">Failures detected</Badge>
          )}
        </div>

        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Production test report
        </h1>
        <p className="text-muted-foreground text-lg mb-4 max-w-2xl">
          Read-only smoke tests against{" "}
          <span className="text-foreground font-medium">{data.targetUrl}</span>.
          A GitHub Action runs <strong>every night</strong>, commits the latest
          results, and this page loads that JSON directly so you see new numbers
          without redeploying the site.
        </p>

        {isPlaceholder && (
          <Card className="mb-10 border-dashed bg-muted/20">
            <CardHeader>
              <CardTitle className="text-lg">Waiting for first nightly run</CardTitle>
              <CardDescription>
                After the workflow runs, results appear here automatically.
                Trigger manually: Actions → &quot;Scheduled prod smoke &amp;
                report&quot; → Run workflow.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <Card className="relative overflow-hidden">
            <div className="absolute right-3 top-3 opacity-20">
              <Gauge className="h-16 w-16" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription>Pass rate</CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums">
                {pw.total > 0 ? `${pw.passRate}%` : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Playwright (@prod-safe, Chromium)
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Passed
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-emerald-500">
                {pw.passed}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              of {pw.total} browser checks
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-400" />
                Failed
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-red-400">
                {pw.failed}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {pw.skipped > 0 ? `${pw.skipped} skipped` : "Including timeouts"}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Last run
              </CardDescription>
              <CardTitle className="text-lg font-semibold leading-tight">
                {formatTime(data.generatedAt)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Duration ~{formatDuration(pw.durationMsTotal)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-10">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>Playwright</CardTitle>
              </div>
              <CardDescription>
                Exit {pw.exitCode ?? "—"} · {pw.total} tests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pw.error && !isPlaceholder && (
                <p className="text-sm text-amber-500">{pw.error}</p>
              )}
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                {pw.total > 0 && (
                  <>
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(pw.passed / pw.total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-red-500/80"
                      style={{ width: `${(pw.failed / pw.total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-muted-foreground/30"
                      style={{ width: `${(pw.skipped / pw.total) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Green = passed · Red = failed · Gray = skipped
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cypress</CardTitle>
              <CardDescription>Prod smoke (manual / optional CI)</CardDescription>
            </CardHeader>
            <CardContent>
              {data.cypress ? (
                <div className="flex items-center gap-3">
                  {data.cypress.ok ? (
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  ) : (
                    <XCircle className="h-10 w-10 text-red-400" />
                  )}
                  <div>
                    <p className="font-medium">
                      {data.cypress.ok ? "Passed" : "Failed"} (exit{" "}
                      {data.cypress.exitCode})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.cypress.note}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Nightly job is Playwright-only. Run{" "}
                  <code className="text-xs bg-muted px-1 rounded">
                    npm run test:cypress:prod
                  </code>{" "}
                  locally for Cypress against production.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {pw.byFile.length > 0 && (
          <Card className="mb-10">
            <CardHeader>
              <CardTitle>By spec file</CardTitle>
              <CardDescription>Playwright breakdown</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Playwright test counts grouped by spec file
                </caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      File
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium w-20">
                      Pass
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium w-20">
                      Fail
                    </th>
                    <th scope="col" className="py-2 font-medium w-20">
                      Skip
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pw.byFile.map((row) => (
                    <tr key={row.file} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{row.file}</td>
                      <td className="py-2 text-emerald-500 tabular-nums">
                        {row.passed}
                      </td>
                      <td className="py-2 text-red-400 tabular-nums">
                        {row.failed}
                      </td>
                      <td className="py-2 text-muted-foreground tabular-nums">
                        {row.skipped}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {pw.failures.length > 0 && (
          <Card className="mb-10 border-red-500/30 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-red-400">Failures</CardTitle>
              <CardDescription>Latest run — human review required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pw.failures.map((f) => (
                <div
                  key={`${f.file}::${f.title}`}
                  className="rounded-lg border border-border/80 bg-background/50 p-4 text-sm"
                >
                  <p className="font-mono text-xs text-muted-foreground mb-1">
                    {f.file}
                  </p>
                  <p className="font-medium mb-2">{f.title}</p>
                  <pre className="text-xs text-red-300/90 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                    {f.error}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/20">
          <CardContent className="pt-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground space-y-2">
              {data.workflowRunUrl && (
                <div>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={data.workflowRunUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open GitHub Actions run
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              )}
              {data.commitSha && (
                <p>
                  Commit{" "}
                  <code className="bg-muted px-1 rounded">{data.commitSha}</code>
                </p>
              )}
            </div>
            <Button variant="ghost" asChild>
              <Link href="/testing">Testing overview</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function TestReportsPage() {
  const { data, source } = await loadTestReport();
  return <ReportsBody data={data} source={source} />;
}

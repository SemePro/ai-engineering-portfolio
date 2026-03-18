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
import {
  loadTestReport,
  loadTestReportHistory,
  testReportPublicBaseUrl,
  type TestReportData,
  type ReportHistoryIndex,
} from "@/lib/load-test-report";
import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { ReportRunnerTabs } from "@/components/testing/report-runner-tabs";
import { ExternalLink, Cloud, HardDrive } from "lucide-react";

export const metadata: Metadata = {
  title: "Test reports | Applied AI Engineering Portfolio",
  description:
    "Nightly production smoke test results for semefit.com — updated every night via GitHub Actions.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
  history,
  historySource,
  reportBaseUrl,
}: {
  data: TestReportData;
  source: string;
  history: ReportHistoryIndex | null;
  historySource: string;
  reportBaseUrl: string;
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
            <Badge variant="outline" className="gap-1 font-normal border-amber-500/50">
              <HardDrive className="h-3 w-3" />
              Bundled deploy (stale)
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
          A GitHub Action runs <strong>every night</strong> (Playwright +
          Cypress prod smoke), commits <strong>latest.json</strong> on every run
          (overwritten), and keeps a <strong>history</strong> of snapshots in
          the repo. This page loads live JSON from the repo (GitHub raw or CDN
          mirror) — no redeploy needed when fetch succeeds.
        </p>

        {source === "local" && (
          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            <strong className="text-amber-200">Not live:</strong> Production
            could not fetch the report from GitHub, so you are seeing the{" "}
            <code className="text-xs bg-black/20 px-1 rounded">latest.json</code>{" "}
            bundled with the last Vercel deploy. After the next deploy this fix
            tries a CDN fallback; also confirm the workflow{" "}
            <strong>pushes to main</strong> and the repo path matches{" "}
            <code className="text-xs break-all">
              SemePro/ai-engineering-portfolio/.../latest.json
            </code>
            .
          </div>
        )}

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

        <Suspense
          fallback={
            <div className="mb-10 h-64 animate-pulse rounded-xl bg-muted/30 border border-border/50" />
          }
        >
          <ReportRunnerTabs data={data} isPlaceholder={isPlaceholder} />
        </Suspense>

        {history && history.runs.length > 0 && (
          <Card className="mb-10">
            <CardHeader>
              <CardTitle>Run history</CardTitle>
              <CardDescription>
                Last {Math.min(40, history.runs.length)} workflow runs (index
                keeps up to 500). Each run has a full JSON snapshot on{" "}
                {historySource === "remote" ? "GitHub" : "disk"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Production smoke test run history
                </caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      When
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Run
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      PW %
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Cypress
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Snapshot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.runs.slice(0, 40).map((r) => (
                    <tr
                      key={r.runId + r.generatedAt}
                      className="border-b border-border/50"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatTime(r.generatedAt)}
                      </td>
                      <td className="py-2 pr-3">
                        {r.workflowRunUrl ? (
                          <a
                            href={r.workflowRunUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline tabular-nums"
                          >
                            #{r.runId}
                          </a>
                        ) : (
                          <span className="tabular-nums">#{r.runId}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {r.overallOk ? (
                          <span className="text-emerald-500">OK</span>
                        ) : (
                          <span className="text-red-400">Fail</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {r.pwTotal > 0 ? `${r.passRate}%` : "—"}
                        {r.pwFailed > 0 && (
                          <span className="text-red-400 ml-1">
                            ({r.pwFailed} fail)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {r.cypressOk === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : r.cypressOk ? (
                          <span className="text-emerald-500">OK</span>
                        ) : (
                          <span className="text-red-400">Fail</span>
                        )}
                      </td>
                      <td className="py-2">
                        <a
                          href={`${reportBaseUrl}/history/runs/${r.runId}.json`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          JSON
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  noStore();
  const [{ data, source }, { data: history, source: historySource }] =
    await Promise.all([loadTestReport(), loadTestReportHistory()]);
  return (
    <ReportsBody
      data={data}
      source={source}
      history={history}
      historySource={historySource}
      reportBaseUrl={testReportPublicBaseUrl()}
    />
  );
}

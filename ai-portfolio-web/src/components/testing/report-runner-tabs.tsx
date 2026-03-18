"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  CheckCircle2,
  Clock,
  Gauge,
  XCircle,
} from "lucide-react";
import type { TestReportData } from "@/lib/load-test-report";
import { cn } from "@/lib/utils";

type Runner = "playwright" | "cypress";

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

export function ReportRunnerTabs({
  data,
  isPlaceholder,
}: {
  data: TestReportData;
  isPlaceholder: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("runner");
  const initial: Runner =
    param === "cypress" ? "cypress" : "playwright";
  const [runner, setRunnerState] = useState<Runner>(initial);

  useEffect(() => {
    const p = searchParams.get("runner");
    if (p === "cypress") setRunnerState("cypress");
    else if (p === "playwright") setRunnerState("playwright");
  }, [searchParams]);

  const setRunner = useCallback(
    (r: Runner) => {
      setRunnerState(r);
      const q = new URLSearchParams(searchParams.toString());
      if (r === "playwright") q.delete("runner");
      else q.set("runner", "cypress");
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const pw = data.playwright;
  const cy = data.cypress;
  const pwTotal = pw.total;
  const cyTotal = cy?.total ?? 0;

  return (
    <div className="mb-10">
      <p className="text-sm text-muted-foreground mb-3">
        Switch runner — URL updates for sharing (
        <code className="text-xs bg-muted px-1 rounded">?runner=cypress</code>
        ).
      </p>
      <div
        className="flex flex-wrap gap-2 p-1 rounded-xl bg-muted/40 border border-border/80 mb-8"
        role="tablist"
        aria-label="Test runner"
      >
        <button
          type="button"
          role="tab"
          aria-selected={runner === "playwright"}
          id="tab-playwright"
          aria-controls="panel-playwright"
          onClick={() => setRunner("playwright")}
          className={cn(
            "flex-1 min-w-[140px] rounded-lg px-4 py-3 text-left transition-colors",
            runner === "playwright"
              ? "bg-background shadow-sm border border-border text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          <span className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary shrink-0" />
            Playwright
          </span>
          <span className="text-sm tabular-nums mt-1 block">
            {pwTotal > 0 ? (
              <>
                <span className="text-emerald-500">{pw.passed}</span>
                <span className="text-muted-foreground">
                  {" "}
                  / {pwTotal} @prod-safe
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No data</span>
            )}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={runner === "cypress"}
          id="tab-cypress"
          aria-controls="panel-cypress"
          onClick={() => setRunner("cypress")}
          className={cn(
            "flex-1 min-w-[140px] rounded-lg px-4 py-3 text-left transition-colors",
            runner === "cypress"
              ? "bg-background shadow-sm border border-border text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          <span className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            Cypress
          </span>
          <span className="text-sm tabular-nums mt-1 block">
            {cy?.hasDetail && cyTotal > 0 ? (
              <>
                <span className="text-emerald-500">{cy.passed}</span>
                <span className="text-muted-foreground">
                  {" "}
                  / {cyTotal} prod-smoke
                </span>
              </>
            ) : cy ? (
              <span className="text-muted-foreground">exit {cy.exitCode}</span>
            ) : (
              <span className="text-muted-foreground">Not in report</span>
            )}
          </span>
        </button>
      </div>

      {runner === "playwright" && (
        <div
          id="panel-playwright"
          role="tabpanel"
          aria-labelledby="tab-playwright"
        >
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

          <Card className="mb-10">
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
                        <td className="py-2 pr-4 font-mono text-xs">
                          {row.file}
                        </td>
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
                <CardTitle className="text-red-400">Playwright failures</CardTitle>
                <CardDescription>Latest run</CardDescription>
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
        </div>
      )}

      {runner === "cypress" && (
        <div
          id="panel-cypress"
          role="tabpanel"
          aria-labelledby="tab-cypress"
        >
          {!cy ? (
            <Card className="mb-10">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Cypress was not recorded for this run. Ensure the scheduled
                workflow runs{" "}
                <code className="text-xs bg-muted px-1 rounded">
                  run-cypress-prod-smoke.mjs
                </code>
                .
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Pass rate</CardDescription>
                    <CardTitle className="text-3xl font-bold tabular-nums">
                      {cy.hasDetail && cy.total > 0 ? `${cy.passRate}%` : "—"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Cypress prod-smoke (Electron)
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Passed
                    </CardDescription>
                    <CardTitle className="text-3xl font-bold tabular-nums text-emerald-500">
                      {cy.hasDetail && cy.total > 0 ? cy.passed : cy.ok ? "—" : 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {cy.hasDetail && cy.total > 0
                      ? `of ${cy.total} tests`
                      : cy.ok
                        ? "See spec table after next run"
                        : "—"}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-400" />
                      Failed
                    </CardDescription>
                    <CardTitle className="text-3xl font-bold tabular-nums text-red-400">
                      {cy.hasDetail ? cy.failed : cy.ok ? 0 : 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Exit {cy.exitCode}
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
                    Same workflow as Playwright
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-10">
                <CardHeader>
                  <CardTitle>Cypress</CardTitle>
                  <CardDescription>Nightly prod-smoke specs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {cy.ok ? (
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-10 w-10 text-red-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">
                        {cy.hasDetail && cy.total > 0 ? (
                          <>
                            <span className="text-emerald-500 tabular-nums">
                              {cy.passed}
                            </span>
                            {" passed"}
                            {cy.failed > 0 && (
                              <>
                                {" · "}
                                <span className="text-red-400 tabular-nums">
                                  {cy.failed}
                                </span>
                                {" failed"}
                              </>
                            )}
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              of {cy.total} tests
                            </span>
                          </>
                        ) : (
                          <>
                            {cy.ok ? "Passed" : "Failed"} (exit {cy.exitCode})
                          </>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{cy.note}</p>
                    </div>
                  </div>
                  {cy.hasDetail && cy.total > 0 && (
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{
                          width: `${(cy.passed / cy.total) * 100}%`,
                        }}
                      />
                      <div
                        className="h-full bg-red-500/80"
                        style={{
                          width: `${(cy.failed / cy.total) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {cy.hasDetail && cy.byFile && cy.byFile.length > 0 && (
                <Card className="mb-10">
                  <CardHeader>
                    <CardTitle>Cypress by spec file</CardTitle>
                    <CardDescription>Prod-smoke breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        Cypress test counts by spec file
                      </caption>
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th scope="col" className="py-2 pr-4 font-medium">
                            File
                          </th>
                          <th scope="col" className="py-2 pr-4 font-medium w-20">
                            Pass
                          </th>
                          <th scope="col" className="py-2 font-medium w-20">
                            Fail
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cy.byFile.map((row) => (
                          <tr
                            key={row.file}
                            className="border-b border-border/50"
                          >
                            <td className="py-2 pr-4 font-mono text-xs">
                              {row.file}
                            </td>
                            <td className="py-2 text-emerald-500 tabular-nums">
                              {row.passed}
                            </td>
                            <td className="py-2 text-red-400 tabular-nums">
                              {row.failed}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {cy.hasDetail && cy.tests && cy.tests.length > 0 && (
                <Card className="mb-10">
                  <CardHeader>
                    <CardTitle>Cypress tests</CardTitle>
                    <CardDescription>Each it() in prod-smoke</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Cypress test cases</caption>
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b text-left text-muted-foreground">
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Spec
                          </th>
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Test
                          </th>
                          <th scope="col" className="py-2 font-medium w-24">
                            Result
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cy.tests.map((t, i) => (
                          <tr
                            key={`${t.file}-${i}-${t.title}`}
                            className="border-b border-border/50"
                          >
                            <td className="py-2 pr-4 font-mono text-xs align-top">
                              {t.file}
                            </td>
                            <td className="py-2 pr-4 align-top">{t.title}</td>
                            <td className="py-2 align-top">
                              {t.ok ? (
                                <span className="text-emerald-500">Pass</span>
                              ) : (
                                <span className="text-red-400">Fail</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {cy.failures && cy.failures.length > 0 && (
                <Card className="mb-10 border-red-500/30 bg-red-500/5">
                  <CardHeader>
                    <CardTitle className="text-red-400">
                      Cypress failures
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {cy.failures.map((f, i) => (
                      <div
                        key={`${f.file}-${i}`}
                        className="rounded-lg border border-border/80 bg-background/50 p-4 text-sm"
                      >
                        <p className="font-mono text-xs text-muted-foreground">
                          {f.file}
                        </p>
                        <p className="font-medium">{f.title}</p>
                        {f.error && (
                          <pre className="text-xs text-red-300/90 mt-2 whitespace-pre-wrap">
                            {f.error}
                          </pre>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

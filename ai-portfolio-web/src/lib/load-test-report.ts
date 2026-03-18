import { readFileSync } from "fs";
import { join } from "path";

/** Default: public JSON on default branch (override with TEST_REPORT_JSON_URL). */
const DEFAULT_REPORT_URL =
  "https://raw.githubusercontent.com/SemePro/ai-engineering-portfolio/main/ai-portfolio-web/public/test-report/latest.json";

export type TestReportData = {
  schemaVersion: number;
  generatedAt: string;
  targetUrl: string;
  placeholder?: boolean;
  overallOk?: boolean;
  workflowRunUrl: string | null;
  commitSha: string | null;
  playwright: {
    ok: boolean;
    exitCode?: number | null;
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    passRate: number;
    durationMsTotal: number;
    byFile: { file: string; passed: number; failed: number; skipped: number }[];
    failures: { file: string; title: string; error: string }[];
    error?: string;
  };
  cypress: { ok: boolean; exitCode: number; note: string } | null;
};

const FALLBACK: TestReportData = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  targetUrl: "https://www.semefit.com",
  placeholder: true,
  overallOk: true,
  workflowRunUrl: null,
  commitSha: null,
  playwright: {
    ok: true,
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    passRate: 0,
    byFile: [],
    failures: [],
    durationMsTotal: 0,
  },
  cypress: null,
};

/**
 * Loads the latest nightly report. Production: fetches from GitHub raw URL so
 * the page updates as soon as the scheduled job commits — no redeploy needed.
 */
export async function loadTestReport(): Promise<{
  data: TestReportData;
  source: "remote" | "local" | "fallback";
}> {
  const url =
    process.env.TEST_REPORT_JSON_URL ||
    process.env.NEXT_PUBLIC_TEST_REPORT_JSON_URL ||
    DEFAULT_REPORT_URL;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as TestReportData;
      return { data, source: "remote" };
    }
  } catch {
    /* try local */
  }

  try {
    const p = join(process.cwd(), "public", "test-report", "latest.json");
    const data = JSON.parse(readFileSync(p, "utf8")) as TestReportData;
    return { data, source: "local" };
  } catch {
    return { data: FALLBACK, source: "fallback" };
  }
}

import { readFileSync } from "fs";
import { join } from "path";

/** Default: public JSON on default branch (forks: set TEST_REPORT_JSON_URL, same allowlist rules). */
const DEFAULT_REPORT_URL =
  "https://raw.githubusercontent.com/SemePro/ai-engineering-portfolio/main/ai-portfolio-web/public/test-report/latest.json";

/** CDN mirror — Vercel/serverless often gets 403 from raw.githubusercontent.com without a browser UA. */
const DEFAULT_REPORT_CDN_URL =
  "https://cdn.jsdelivr.net/gh/SemePro/ai-engineering-portfolio@main/ai-portfolio-web/public/test-report/latest.json";

const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "SemeFit-TestReport/1.0 (+https://www.semefit.com/testing/reports)",
} as const;

function allowedHosts(): Set<string> {
  const extra = process.env.TEST_REPORT_JSON_ALLOWED_HOSTS || "";
  const hosts = [
    "raw.githubusercontent.com",
    ...extra.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
  ];
  return new Set(hosts);
}

/**
 * Only fetch from HTTPS + allowlisted hosts (mitigates SSRF via env).
 * Custom URL: server env TEST_REPORT_JSON_URL only — not NEXT_PUBLIC_*.
 */
export function isAllowedReportUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "https:") return false;
    return allowedHosts().has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export type TestReportData = {
  schemaVersion: number;
  generatedAt: string;
  targetUrl: string;
  placeholder?: boolean;
  overallOk?: boolean;
  workflowRunUrl: string | null;
  commitSha: string | null;
  githubRunId?: string | null;
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
  cypress: {
    ok: boolean;
    exitCode: number;
    note: string;
    passed: number;
    failed: number;
    total: number;
    passRate: number;
    hasDetail?: boolean;
    byFile?: { file: string; passed: number; failed: number }[];
    tests?: { title: string; file: string; ok: boolean; error?: string }[];
    failures?: { title: string; file: string; ok: boolean; error?: string }[];
  } | null;
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

function resolveReportUrl(): string {
  const custom = process.env.TEST_REPORT_JSON_URL?.trim();
  if (custom && isAllowedReportUrl(custom)) return custom;
  if (custom && !isAllowedReportUrl(custom)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[test-report] TEST_REPORT_JSON_URL rejected (use HTTPS + allowed host; extend TEST_REPORT_JSON_ALLOWED_HOSTS if needed). Using default."
      );
    }
  }
  return DEFAULT_REPORT_URL;
}

function reportUrlsToTry(): string[] {
  const primary = resolveReportUrl();
  const urls = [primary];
  if (primary === DEFAULT_REPORT_URL) {
    urls.push(DEFAULT_REPORT_CDN_URL);
  }
  return urls;
}

/**
 * Loads the latest nightly report. Tries GitHub raw, then jsDelivr (raw often 403 from serverless).
 */
export async function loadTestReport(): Promise<{
  data: TestReportData;
  source: "remote" | "local" | "fallback";
}> {
  for (const url of reportUrlsToTry()) {
    if (!url.startsWith("https://")) continue;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        next: { revalidate: 0 },
        headers: { ...FETCH_HEADERS },
      });
      if (res.ok) {
        const data = (await res.json()) as TestReportData;
        return { data, source: "remote" };
      }
    } catch {
      /* try next URL */
    }
  }

  try {
    const p = join(process.cwd(), "public", "test-report", "latest.json");
    const data = JSON.parse(readFileSync(p, "utf8")) as TestReportData;
    return { data, source: "local" };
  } catch {
    return { data: FALLBACK, source: "fallback" };
  }
}

export type ReportHistoryEntry = {
  runId: string;
  generatedAt: string;
  overallOk: boolean;
  workflowRunUrl: string | null;
  passRate: number;
  pwTotal: number;
  pwFailed: number;
  cypressOk: boolean | null;
};

export type ReportHistoryIndex = {
  schemaVersion: number;
  runs: ReportHistoryEntry[];
};

function resolveHistoryIndexUrl(): string | null {
  const custom = process.env.TEST_REPORT_HISTORY_INDEX_URL?.trim();
  if (custom && isAllowedReportUrl(custom)) return custom;
  const latest = resolveReportUrl();
  if (latest.includes("latest.json")) {
    return latest.replace("latest.json", "history/index.json");
  }
  return null;
}

function historyIndexUrlsToTry(): string[] {
  const u = resolveHistoryIndexUrl();
  if (!u) return [];
  const urls = [u];
  if (u.includes("raw.githubusercontent.com")) {
    const cdn = u.replace(
      /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/,
      "https://cdn.jsdelivr.net/gh/$1/$2@$3/$4"
    );
    if (cdn !== u) urls.push(cdn);
  }
  return urls;
}

/** Base URL for raw JSON under public/test-report (for snapshot links). */
export function testReportPublicBaseUrl(): string {
  return resolveReportUrl().replace(/\/latest\.json\/?$/, "");
}

/**
 * Rolling index of recent runs (full snapshots in history/runs/{runId}.json on the same branch).
 */
export async function loadTestReportHistory(): Promise<{
  data: ReportHistoryIndex | null;
  source: "remote" | "local" | "none";
}> {
  const urls = historyIndexUrlsToTry();
  if (urls.length === 0) {
    return { data: null, source: "none" };
  }
  for (const url of urls) {
    if (!url.startsWith("https://")) continue;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        next: { revalidate: 0 },
        headers: { ...FETCH_HEADERS },
      });
      if (res.ok) {
        const data = (await res.json()) as ReportHistoryIndex;
        if (data?.runs && Array.isArray(data.runs)) {
          return { data, source: "remote" };
        }
      }
    } catch {
      /* next */
    }
  }
  try {
    const p = join(
      process.cwd(),
      "public",
      "test-report",
      "history",
      "index.json"
    );
    const data = JSON.parse(readFileSync(p, "utf8")) as ReportHistoryIndex;
    return { data, source: "local" };
  } catch {
    return { data: null, source: "none" };
  }
}

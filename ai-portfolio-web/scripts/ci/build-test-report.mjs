#!/usr/bin/env node
/**
 * Aggregates Playwright (and optional Cypress) JSON into public/test-report/latest.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outPath = path.join(root, "public/test-report/latest.json");
const pwPath = path.join(root, "test-results/scheduled-playwright.json");
const pwExitPath = path.join(root, "test-results/pw-exit.txt");

function readExit(p) {
  try {
    const v = parseInt(fs.readFileSync(p, "utf8").trim(), 10);
    return Number.isNaN(v) ? null : v;
  } catch {
    return null;
  }
}

function walkSuites(suites, visitor) {
  if (!suites) return;
  for (const s of suites) {
    for (const spec of s.specs || []) {
      for (const t of spec.tests || []) {
        const results = t.results || [];
        const last = results[results.length - 1];
        const status = last?.status || "unknown";
        const projectName = t.projectName || "default";
        visitor({
          file: spec.file || s.file || "unknown",
          title: spec.title,
          projectName,
          status,
          durationMs: last?.duration ?? 0,
          errors: last?.errors?.map((e) => (typeof e === "string" ? e : e?.message || String(e))) || [],
        });
      }
    }
    walkSuites(s.suites, visitor);
  }
}

function aggregatePlaywright() {
  const exitCode = readExit(pwExitPath);
  if (!fs.existsSync(pwPath)) {
    return {
      ok: false,
      exitCode,
      error:
        exitCode !== 0
          ? "Playwright run failed before report was written"
          : "scheduled-playwright.json missing",
      passed: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0,
      total: 0,
      byFile: [],
      failures: [],
      durationMsTotal: 0,
    };
  }
  const raw = JSON.parse(fs.readFileSync(pwPath, "utf8"));
  const byFileMap = new Map();
  let passed = 0,
    failed = 0,
    skipped = 0,
    timedOut = 0,
    durationMsTotal = 0;
  const failures = [];

  walkSuites(raw.suites, (row) => {
    durationMsTotal += row.durationMs;
    const st = row.status;
    if (st === "passed") passed++;
    else if (st === "skipped") skipped++;
    else if (st === "timedOut") {
      timedOut++;
      failed++;
      failures.push({
        file: row.file,
        title: `${row.title} (${row.projectName})`,
        error: "Timed out",
      });
    } else if (st === "failed" || st === "unexpected") {
      failed++;
      failures.push({
        file: row.file,
        title: `${row.title} (${row.projectName})`,
        error: row.errors[0] || "Failed",
      });
    } else if (st === "interrupted") {
      failed++;
      failures.push({
        file: row.file,
        title: row.title,
        error: "Interrupted",
      });
    }

    const key = row.file;
    if (!byFileMap.has(key)) {
      byFileMap.set(key, { file: key, passed: 0, failed: 0, skipped: 0 });
    }
    const agg = byFileMap.get(key);
    if (st === "passed") agg.passed++;
    else if (st === "skipped") agg.skipped++;
    else agg.failed++;
  });

  const total = passed + failed + skipped;
  const exitCode2 = readExit(pwExitPath);
  return {
    ok: failed === 0 && timedOut === 0 && (exitCode2 === null || exitCode2 === 0),
    exitCode: exitCode2,
    passed,
    failed,
    skipped,
    timedOut,
    total,
    passRate: total ? Math.round((passed / total) * 1000) / 10 : 0,
    byFile: [...byFileMap.values()].sort((a, b) => a.file.localeCompare(b.file)),
    failures,
    durationMsTotal,
  };
}

const pw = aggregatePlaywright();
/** Cypress prod smoke is run locally/CI separately; optional extension point */
const cypress = null;

const repo = process.env.GITHUB_REPOSITORY || "SemePro/ai-engineering-portfolio";
const runId = process.env.GITHUB_RUN_ID;
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const workflowRunUrl = runId
  ? `${serverUrl}/${repo}/actions/runs/${runId}`
  : null;

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  environment: "production",
  targetUrl: "https://www.semefit.com",
  playwright: pw,
  cypress,
  workflowRunUrl,
  commitSha: process.env.GITHUB_SHA?.slice(0, 7) || null,
  overallOk: Boolean(pw.ok),
  placeholder: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log("Wrote", outPath);
console.log(
  JSON.stringify({
    playwright: { passed: pw.passed, failed: pw.failed, total: pw.total },
    cypress,
  })
);

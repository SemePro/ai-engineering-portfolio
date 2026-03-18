#!/usr/bin/env node
/**
 * Aggregates Playwright JSON into public/test-report/latest.json.
 * Exits 1 if tests did not pass (workflow should use `if: always()` on commit step).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outPath = path.join(root, "public/test-report/latest.json");
const pwPath = path.join(root, "test-results/scheduled-playwright.json");
const pwExitPath = path.join(root, "test-results/pw-exit.txt");
const cyExitPath = path.join(root, "test-results/cypress-exit.txt");

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
          errors:
            last?.errors?.map((e) =>
              typeof e === "string" ? e : e?.message || String(e)
            ) || [],
        });
      }
    }
    walkSuites(s.suites, visitor);
  }
}

function classifyStatus(st) {
  if (st === "passed") return "passed";
  if (st === "skipped") return "skipped";
  return "failed";
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
    const bucket = classifyStatus(st);

    if (bucket === "passed") passed++;
    else if (bucket === "skipped") skipped++;
    else {
      failed++;
      if (st === "timedOut") timedOut++;
      let err =
        st === "timedOut"
          ? "Timed out"
          : st === "interrupted"
            ? "Interrupted"
            : st === "unknown"
              ? "Unknown status"
              : row.errors[0] || "Failed";
      failures.push({
        file: row.file,
        title: `${row.title} (${row.projectName})`,
        error: err,
      });
    }

    const key = row.file;
    if (!byFileMap.has(key)) {
      byFileMap.set(key, { file: key, passed: 0, failed: 0, skipped: 0 });
    }
    const agg = byFileMap.get(key);
    if (bucket === "passed") agg.passed++;
    else if (bucket === "skipped") agg.skipped++;
    else agg.failed++;
  });

  const total = passed + failed + skipped;
  const exitCode2 = readExit(pwExitPath);
  return {
    ok: failed === 0 && (exitCode2 === null || exitCode2 === 0),
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

function aggregateCypress() {
  if (!fs.existsSync(cyExitPath)) return null;
  const code = readExit(cyExitPath);
  const ok = code === 0;
  return {
    ok,
    exitCode: code ?? -1,
    note: "cypress/e2e/prod-smoke (headless)",
  };
}

const pw = aggregatePlaywright();
const cypress = aggregateCypress();

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
  overallOk: Boolean(pw.ok && (cypress === null || cypress.ok)),
  placeholder: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log("Wrote", outPath);
console.log(
  JSON.stringify({
    playwright: { passed: pw.passed, failed: pw.failed, total: pw.total, ok: pw.ok },
    cypress,
  })
);

const allGreen = pw.ok && (cypress === null || cypress.ok);
process.exit(allGreen ? 0 : 1);

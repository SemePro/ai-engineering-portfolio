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
const cyJUnitPath = path.join(root, "test-results/cypress-junit.xml");
const cyModulePath = path.join(root, "test-results/cypress-module.json");

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

/**
 * Parse Cypress JUnit (mochaFile) for per-spec + per-test breakdown.
 */
function parseCypressJUnit(xml) {
  const byFileMap = new Map();
  const tests = [];
  let lastSpecFile = "unknown.cy.ts";
  const suiteRegex = /<testsuite\s+([^>]*)>([\s\S]*?)<\/testsuite>/gi;
  let m;
  while ((m = suiteRegex.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const fileMatch = attrs.match(/file="([^"]+)"/);
    if (fileMatch) {
      const p = fileMatch[1];
      lastSpecFile = p.includes("/") ? p.split("/").pop() : p;
    }
    const caseRegex =
      /<testcase\s+[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/testcase>/gi;
    let cm;
    while ((cm = caseRegex.exec(body)) !== null) {
      const title = cm[1].replace(/^Prod smoke @prod-safe\s+/i, "").trim();
      const inner = cm[2];
      const fail = /<failure\b/i.test(inner);
      const errMatch = inner.match(/<failure[^>]*>([\s\S]*?)<\/failure>/i);
      const error = errMatch
        ? errMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").slice(0, 500)
        : "";
      if (!title) continue;
      tests.push({
        title: title || cm[1],
        file: lastSpecFile,
        ok: !fail,
        error: fail ? error || "Failed" : undefined,
      });
      if (!byFileMap.has(lastSpecFile)) {
        byFileMap.set(lastSpecFile, {
          file: lastSpecFile,
          passed: 0,
          failed: 0,
        });
      }
      const row = byFileMap.get(lastSpecFile);
      if (fail) row.failed++;
      else row.passed++;
    }
  }
  const passed = tests.filter((t) => t.ok).length;
  const failed = tests.length - passed;
  const total = tests.length;
  return {
    byFile: [...byFileMap.values()].sort((a, b) => a.file.localeCompare(b.file)),
    tests,
    passed,
    failed,
    total,
    passRate: total ? Math.round((passed / total) * 1000) / 10 : 0,
  };
}

function aggregateCypress() {
  if (!fs.existsSync(cyExitPath) && !fs.existsSync(cyModulePath)) return null;

  if (fs.existsSync(cyModulePath)) {
    try {
      const m = JSON.parse(fs.readFileSync(cyModulePath, "utf8"));
      const code = readExit(cyExitPath);
      const ok = code === null ? m.failed === 0 : code === 0;
      return {
        ok,
        exitCode: code ?? (m.failed > 0 ? 1 : 0),
        note: "cypress/e2e/prod-smoke (module API)",
        passed: m.passed,
        failed: m.failed,
        total: m.total,
        passRate: m.passRate,
        byFile: m.byFile || [],
        tests: (m.tests || []).slice(0, 200),
        failures: (m.tests || []).filter((t) => !t.ok),
        hasDetail: m.total > 0,
      };
    } catch (e) {
      console.warn("[test-report] cypress-module.json:", e?.message || e);
    }
  }

  if (!fs.existsSync(cyExitPath)) return null;
  const code = readExit(cyExitPath);
  const ok = code === 0;
  let detail = {
    byFile: [],
    tests: [],
    passed: 0,
    failed: 0,
    total: 0,
    passRate: 0,
  };
  try {
    if (fs.existsSync(cyJUnitPath)) {
      detail = parseCypressJUnit(fs.readFileSync(cyJUnitPath, "utf8"));
    }
  } catch (e) {
    console.warn("[test-report] Cypress JUnit parse error:", e?.message || e);
  }
  const hasTests = detail.total > 0;
  return {
    ok,
    exitCode: code ?? -1,
    note: "cypress/e2e/prod-smoke (Electron headless)",
    passed: hasTests ? detail.passed : ok ? 0 : 0,
    failed: hasTests ? detail.failed : ok ? 0 : 1,
    total: hasTests ? detail.total : ok ? 0 : 1,
    passRate: hasTests ? detail.passRate : ok ? 100 : 0,
    byFile: detail.byFile,
    tests: detail.tests.slice(0, 80),
    failures: detail.tests.filter((t) => !t.ok),
    hasDetail: hasTests,
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
  githubRunId: runId || null,
  overallOk: Boolean(pw.ok && (cypress === null || cypress.ok)),
  placeholder: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

/** Per-run snapshot + rolling index (each workflow run overwrites latest.json and appends history). */
if (runId) {
  const histRuns = path.join(root, "public/test-report/history/runs");
  fs.mkdirSync(histRuns, { recursive: true });
  fs.writeFileSync(
    path.join(histRuns, `${runId}.json`),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  const idxPath = path.join(root, "public/test-report/history/index.json");
  let idx = { schemaVersion: 1, runs: [] };
  if (fs.existsSync(idxPath)) {
    try {
      idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
    } catch {
      /* reset */
    }
  }
  if (!Array.isArray(idx.runs)) idx.runs = [];
  idx.runs.unshift({
    runId: String(runId),
    generatedAt: report.generatedAt,
    overallOk: report.overallOk,
    workflowRunUrl: report.workflowRunUrl,
    passRate: report.playwright.passRate,
    pwTotal: report.playwright.total,
    pwFailed: report.playwright.failed,
    cypressOk: report.cypress ? report.cypress.ok : null,
  });
  idx.runs = idx.runs.slice(0, 500);
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), "utf8");
}
console.log("Wrote", outPath);
console.log(
  JSON.stringify({
    playwright: { passed: pw.passed, failed: pw.failed, total: pw.total, ok: pw.ok },
    cypress,
  })
);

const allGreen = pw.ok && (cypress === null || cypress.ok);
/** In GitHub Actions (CI=true), always exit 0 so commit runs; workflow fails in a final step if !overallOk. */
process.exit(process.env.CI === "true" ? 0 : allGreen ? 0 : 1);

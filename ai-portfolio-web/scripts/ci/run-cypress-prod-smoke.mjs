#!/usr/bin/env node
/**
 * Runs prod-smoke Cypress via Module API and writes test-results/cypress-module.json
 * (JUnit is flaky in CI when Mocha version cannot be determined.)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const cypress = require("cypress");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, "test-results");
const moduleJson = path.join(outDir, "cypress-module.json");
const exitFile = path.join(outDir, "cypress-exit.txt");

function writeExit(code) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(exitFile, String(code), "utf8");
}

async function main() {
  const baseUrl =
    process.env.TEST_BASE_URL?.replace(/\/$/, "") || "https://www.semefit.com";

  const result = await cypress.run({
    project: root,
    spec: "cypress/e2e/prod-smoke/**/*.cy.ts",
    config: { baseUrl },
    quiet: true,
  });

  if (result && result.status === "failed") {
    console.error("Cypress run failed:", result.message);
    writeExit(1);
    process.exit(1);
  }

  const byFileMap = new Map();
  const tests = [];

  for (const run of result.runs || []) {
    const file =
      run.spec?.name ||
      (run.spec?.relative && path.basename(run.spec.relative)) ||
      "unknown.cy.ts";
    if (!byFileMap.has(file)) {
      byFileMap.set(file, { file, passed: 0, failed: 0 });
    }
    const row = byFileMap.get(file);
    for (const t of run.tests || []) {
      const title = Array.isArray(t.title)
        ? t.title.filter(Boolean).join(" › ")
        : String(t.title || "");
      const ok = t.state === "passed";
      if (ok) row.passed++;
      else row.failed++;
      tests.push({
        title,
        file,
        ok,
        error: ok ? undefined : t.displayError || t.state || "failed",
      });
    }
  }

  const passed = tests.filter((x) => x.ok).length;
  const failed = tests.length - passed;
  const total = tests.length;
  const passRate = total ? Math.round((passed / total) * 1000) / 10 : 0;
  const exitCode = result.totalFailed > 0 || failed > 0 ? 1 : 0;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    moduleJson,
    JSON.stringify(
      {
        passed,
        failed,
        total,
        passRate,
        byFile: [...byFileMap.values()].sort((a, b) =>
          a.file.localeCompare(b.file)
        ),
        tests: tests.slice(0, 120),
      },
      null,
      2
    ),
    "utf8"
  );
  writeExit(exitCode);

  console.log(
    JSON.stringify({
      cypress: { passed, failed, total, exitCode, moduleJson: true },
    })
  );
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  writeExit(1);
  process.exit(1);
});

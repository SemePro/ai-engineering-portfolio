#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, "tests/reports");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(spec\.ts|cy\.ts)$/.test(e)) acc.push(p);
  }
  return acc;
}

const inventory = JSON.parse(
  fs.readFileSync(path.join(root, "tests/utils/route-inventory.json"), "utf8")
);
const routes = inventory.routes.map((r) => r.path);

const specPaths = [
  ...walk(path.join(root, "tests/playwright")),
  ...walk(path.join(root, "cypress/e2e")),
];
const combined = specPaths.map((f) => fs.readFileSync(f, "utf8")).join("\n");

const covered = [];
const maybeMissing = [];
for (const p of routes) {
  if (combined.includes(p)) covered.push(p);
  else maybeMissing.push(p);
}

let report = `# Test coverage gap analysis (static)\n\nGenerated: ${new Date().toISOString()}\n\n`;
report += `## Routes referenced in spec source\n`;
report += covered.map((x) => `- ${x}`).join("\n") || "(none)";
report += `\n\n## Routes not found as literal strings in specs\n`;
report += maybeMissing.map((x) => `- ${x}`).join("\n") || "(none)";
report += `\n\n_Note: tests may still reach routes via navigation without string literals._\n`;

const key = process.env.OPENAI_API_KEY;
if (key) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.TESTING_AI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Routes with literal path in tests: ${JSON.stringify(covered)}. Not literal: ${JSON.stringify(maybeMissing)}. Suggest 5 priority tests. Markdown bullets only.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });
  if (res.ok) {
    const data = await res.json();
    report += `\n## AI-assisted recommendations\n\n${data.choices?.[0]?.message?.content || ""}\n`;
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "ai-gap-analysis.md"), report, "utf8");
console.log("Wrote tests/reports/ai-gap-analysis.md");

#!/usr/bin/env node
/**
 * AI-assisted failure triage from test logs (human-reviewed).
 * Usage:
 *   npm run test:playwright 2>&1 | node scripts/testing-ai/triage-failure.mjs
 *   node scripts/testing-ai/triage-failure.mjs path/to/log.txt
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, "tests/reports");

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("OPENAI_API_KEY is required for AI-assisted triage.");
  process.exit(1);
}

let logText = "";
const arg = process.argv[2];
if (arg && fs.existsSync(arg)) {
  logText = fs.readFileSync(arg, "utf8");
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  logText = Buffer.concat(chunks).toString("utf8");
}

if (!logText.trim()) {
  console.error("No log input. Pipe stderr/stdout or pass a log file path.");
  process.exit(1);
}

const truncated =
  logText.length > 24_000 ? logText.slice(-24_000) + "\n…(truncated)" : logText;
const model = process.env.TESTING_AI_MODEL || "gpt-4o-mini";

const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content: `You triage automated test failures. Respond in Markdown with:
## Summary (2-3 sentences)
## Likely impacted area (frontend route, API, infra, flake)
## Suspected component or layer
## Suggested next debugging steps (numbered, concrete)
Keep it practical. If log is ambiguous, say so.`,
      },
      {
        role: "user",
        content: `Test failure log:\n\`\`\`\n${truncated}\n\`\`\``,
      },
    ],
    temperature: 0.3,
    max_tokens: 1_500,
  }),
});

if (!res.ok) {
  console.error("OpenAI API error:", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const text = data.choices?.[0]?.message?.content || "";
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const mdPath = path.join(outDir, `ai-triage-${stamp}.md`);
fs.writeFileSync(
  mdPath,
  `<!-- AI-assisted triage | ${new Date().toISOString()} | ${model} -->\n\n${text}`,
  "utf8"
);
console.log("Wrote", mdPath);

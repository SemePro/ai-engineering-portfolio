import { test, expect } from "@playwright/test";

/** Read-only: verify demo shells render (no API submissions). */
const demos: { path: string; heading: RegExp }[] = [
  { path: "/demo/rag", heading: /RAG Knowledge Assistant/i },
  { path: "/demo/eval", heading: /LLM Eval Dashboard/i },
  { path: "/demo/gateway", heading: /Secure AI Gateway/i },
  { path: "/demo/incident", heading: /AI Incident Investigator/i },
  { path: "/demo/devops", heading: /AI DevOps Control Plane/i },
  { path: "/demo/architecture", heading: /AI Solution Architecture Review/i },
];

test.describe("Demo pages shell @prod-safe", () => {
  for (const { path, heading } of demos) {
    test(`${path} renders heading @prod-safe`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    });
  }
});

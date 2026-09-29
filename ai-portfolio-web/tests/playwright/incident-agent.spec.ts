import { test, expect } from "@playwright/test";

test.describe("Incident agent pages @prod-safe", () => {
  test("case study explains the system and links to evidence @prod-safe", async ({ page }) => {
    await page.goto("/projects/incident-agent");
    await expect(page.getByRole("heading", { level: 1, name: /Agentic Incident Response Engine/i })).toBeVisible();
    for (const section of ["Problem", "Architecture", "Engineering decisions", "Safety and reliability", "Evaluation", "Measured results"]) {
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${section}`, "i") })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: /Incident agent architecture/i }).or(page.getByRole("list", { name: /Incident agent architecture/i })).first()).toBeVisible();
  });

  test("eval page never shows invented numbers for unmeasured runs @prod-safe", async ({ page }) => {
    await page.goto("/projects/incident-agent/evals");
    const table = page.getByRole("table", { name: /Incident agent evaluation results/i });
    await expect(table).toBeVisible();
    const claudeCell = table.getByRole("row", { name: /Root-cause accuracy/i }).getByRole("cell").first();
    await expect(claudeCell).toHaveText(/(\d+%|Not measured)/);
  });

  test("trace viewer replays a recorded investigation @prod-safe", async ({ page }) => {
    await page.goto("/projects/incident-agent/trace?case=inc-01-checkout-pool-saturation__base");
    await page.getByRole("button", { name: /Show all/i }).click();
    await expect(page.getByText(/Alert received: CheckoutLatencyP99High/)).toBeVisible();
    await expect(page.getByText(/Change history queried/).first()).toBeVisible();
    await expect(page.getByRole("complementary", { name: /Investigation summary/i })).toContainText(/Graded:/);
  });

  test("home has no horizontal overflow @prod-safe", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

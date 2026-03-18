import { test, expect } from "@playwright/test";

/**
 * Local-only: simulates gateway failure. Not run in prod-smoke (no @prod-safe).
 */
test.describe("Integration — graceful degradation", () => {
  test("RAG demo shows error UI when gateway unreachable", async ({ page }) => {
    await page.route("**/rag/ask", (route) => route.abort("failed"));

    await page.goto("/demo/rag");
    await page.getByPlaceholder(/ask a question/i).fill("test question");
    await page.locator("form").locator('button[type="submit"]').click();

    await expect(page.locator(".text-destructive").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("eval demo page still renders when runs API fails", async ({ page }) => {
    await page.route(
      (url) => {
        try {
          const u = new URL(url);
          return u.port === "8002" || u.href.includes(":8002/");
        } catch {
          return false;
        }
      },
      (route) => route.abort("failed")
    );
    await page.goto("/demo/eval");
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 15_000 });
  });
});

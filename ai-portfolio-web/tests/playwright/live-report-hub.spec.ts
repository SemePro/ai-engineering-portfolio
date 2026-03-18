import { test, expect } from "@playwright/test";

/**
 * Validates the public test-report UX (no LinkedIn-specific checks).
 */
test.describe("Live report & testing hub @prod-safe", () => {
  test("reports dashboard loads @prod-safe", async ({ page }) => {
    await page.goto("/testing/reports");
    await expect(
      page.getByRole("heading", { name: /production test report/i })
    ).toBeVisible();
    await expect(
      page.getByText(/pass rate|waiting for first nightly run/i).first()
    ).toBeVisible();
  });

  test("testing landing reaches live report @prod-safe", async ({ page }) => {
    await page.goto("/testing");
    await page.locator('a[href="/testing/reports"]').first().click();
    await expect(page).toHaveURL(/\/testing\/reports\/?$/);
    await expect(
      page.getByRole("heading", { name: /production test report/i })
    ).toBeVisible();
  });
});

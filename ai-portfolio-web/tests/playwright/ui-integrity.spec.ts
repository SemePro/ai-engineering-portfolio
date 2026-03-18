import { test, expect } from "@playwright/test";

test.describe("UI integrity @prod-safe", () => {
  test("header logo links home @prod-safe", async ({ page }) => {
    await page.goto("/projects");
    await page.locator("header").locator('a[href="/"]').first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("footer has Projects and Testing columns @prod-safe", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Testing" })).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "GitHub repository" })
    ).toBeVisible();
  });

  test("main landmark present on key routes @prod-safe", async ({ page }) => {
    for (const path of ["/", "/demo", "/testing/playwright"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
    }
  });
});

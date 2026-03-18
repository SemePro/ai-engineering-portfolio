import { test, expect } from "@playwright/test";
import { TESTING_SUBPATHS } from "../utils/env";

test.describe("Testing section @prod-safe", () => {
  test("testing landing renders @prod-safe", async ({ page }) => {
    await page.goto("/testing");
    await expect(
      page.locator("main").getByRole("heading", { name: /^Testing$/i, level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText(/reliability-first engineering workflow/i)
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /AI in the testing workflow/i })
    ).toBeVisible();
  });

  for (const path of TESTING_SUBPATHS) {
    test(`subpage ${path} renders @prod-safe`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: /Testing sections/i })).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
    });
  }
});

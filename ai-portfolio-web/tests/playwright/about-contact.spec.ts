import { test, expect } from "@playwright/test";

test.describe("About & Contact @prod-safe", () => {
  test("about shows career context @prod-safe", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /^About$/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Career Context/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Senior Software Engineer/i).first()
    ).toBeVisible();
  });

  test("contact shows GitHub @prod-safe", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: /^Contact$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /GitHub/i }).first()).toBeVisible();
  });
});

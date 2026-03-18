import { test, expect } from "@playwright/test";

/**
 * Enforces removal of LinkedIn from public surfaces (contact, footer, header).
 */
test.describe("LinkedIn absent @prod-safe", () => {
  const pages = ["/", "/contact", "/projects", "/about", "/testing"];

  for (const path of pages) {
    test(`no LinkedIn on ${path} @prod-safe`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('a[href*="linkedin.com"]')).toHaveCount(0);
      await expect(page.locator('a[href*="linkedin"]')).toHaveCount(0);
      const html = (await page.content()).toLowerCase();
      expect(html).not.toContain("linkedin.com");
    });
  }

  test("contact page has no LinkedIn text @prod-safe", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByText(/^LinkedIn$/i)).toHaveCount(0);
  });
});

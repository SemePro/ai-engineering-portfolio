import { test, expect } from "@playwright/test";

/**
 * No LinkedIn links in header, footer, or main content areas (avoids false
 * positives from incidental body copy mentioning "linkedin.com").
 */
test.describe("LinkedIn absent @prod-safe", () => {
  const pages = ["/", "/contact", "/projects", "/about", "/testing"];

  for (const path of pages) {
    test(`no LinkedIn links in chrome on ${path} @prod-safe`, async ({
      page,
    }) => {
      await page.goto(path);
      const chrome = page.locator("header, footer, main");
      await expect(chrome.locator('a[href*="linkedin.com"]')).toHaveCount(0);
      await expect(chrome.locator('a[href*="linkedin"]')).toHaveCount(0);
    });
  }

  test("contact has no LinkedIn label or card @prod-safe", async ({
    page,
  }) => {
    await page.goto("/contact");
    await expect(page.getByText(/^LinkedIn$/i)).toHaveCount(0);
    await expect(page.locator("main").getByText(/linkedin/i)).toHaveCount(0);
  });
});

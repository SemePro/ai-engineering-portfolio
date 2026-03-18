import { test, expect } from "@playwright/test";

test.describe("Core pages @prod-safe", () => {
  test("homepage loads with hero @prod-safe", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .locator("main")
        .getByRole("heading", {
          name: /Applied AI Engineering Portfolio/i,
          level: 1,
        })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /View Live Demos/i })
    ).toBeVisible();
  });

  test("projects page renders @prod-safe", async ({ page }) => {
    await page.goto("/projects");
    await expect(
      page.locator("main").getByRole("heading", { name: /^Projects$/i, level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText(/AI Knowledge Retrieval/i).first()
    ).toBeVisible();
  });

  test("demo hub renders @prod-safe", async ({ page }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: /Live Demonstrations/i })
    ).toBeVisible();
  });

  test("architecture page renders @prod-safe", async ({ page }) => {
    await page.goto("/architecture");
    await expect(
      page.getByRole("heading", { name: /^Architecture$/i })
    ).toBeVisible();
    await expect(page.getByText(/Secure AI Gateway/i).first()).toBeVisible();
  });
});

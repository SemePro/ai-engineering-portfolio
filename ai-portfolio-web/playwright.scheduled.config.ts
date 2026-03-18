/**
 * Used by GitHub Actions scheduled prod smoke only.
 * JSON written to test-results/scheduled-playwright.json for the site report.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 2,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/scheduled-playwright.json" }],
  ],
  use: {
    baseURL: "https://www.semefit.com",
    trace: "off",
    screenshot: "only-on-failure",
  },
  grep: /@prod-safe/,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

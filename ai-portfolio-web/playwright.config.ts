import { defineConfig, devices } from "@playwright/test";

const isProdSmoke = process.env.TEST_MODE === "prod-smoke";
/** Dedicated port avoids clashing with a dev server on 3000 */
const pwPort = process.env.PW_PORT || "3001";
const defaultLocal = `http://127.0.0.1:${pwPort}`;
const baseURL =
  process.env.TEST_BASE_URL?.replace(/\/$/, "") ||
  (isProdSmoke ? "https://www.semefit.com" : defaultLocal);

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: isProdSmoke ? 1 : 0,
  workers: isProdSmoke ? 2 : undefined,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "tests/reports/playwright-html",
      },
    ],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  grep: isProdSmoke ? /@prod-safe/ : undefined,
  projects: isProdSmoke
    ? [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
    : [
        { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile", use: { ...devices["Pixel 5"] } },
      ],
  webServer: isProdSmoke
    ? undefined
    : {
        command: `npm run dev -- -p ${pwPort}`,
        url: defaultLocal,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});

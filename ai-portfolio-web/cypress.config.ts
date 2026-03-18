import { defineConfig } from "cypress";

const baseUrl =
  process.env.TEST_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

/** Set in GitHub Actions + test:cypress:prod so JUnit is always written (CLI flags are easy to break in YAML). */
const writeJUnitForReport =
  process.env.CI_REPORT_JUNIT === "1" || process.env.CYPRESS_JUNIT_REPORT === "1";

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15_000,
    pageLoadTimeout: 45_000,
    ...(writeJUnitForReport
      ? {
          reporter: "junit",
          reporterOptions: {
            mochaFile: "test-results/cypress-junit.xml",
            toConsole: false,
          },
        }
      : {}),
  },
});

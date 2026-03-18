import { defineConfig } from "cypress";

const baseUrl =
  process.env.TEST_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15_000,
    pageLoadTimeout: 45_000,
  },
});

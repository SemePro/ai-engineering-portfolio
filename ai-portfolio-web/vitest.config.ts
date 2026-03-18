import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/api/**/*.test.ts"],
    environment: "node",
    testTimeout: 25_000,
    hookTimeout: 15_000,
    passWithNoTests: true,
  },
});

/**
 * Shared test environment helpers.
 * @see docs/TESTING.md
 */

export function getBaseUrl(): string {
  return (
    process.env.TEST_BASE_URL ||
    process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.CYPRESS_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getGatewayUrl(): string {
  const u =
    process.env.TEST_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    "http://localhost:8000";
  return u.replace(/\/$/, "");
}

export function isProdSmoke(): boolean {
  return process.env.TEST_MODE === "prod-smoke";
}

export const TESTING_SUBPATHS = [
  "/testing/automation",
  "/testing/playwright",
  "/testing/cypress",
  "/testing/ui-tests",
  "/testing/api-tests",
  "/testing/integration-tests",
] as const;

import { describe, test, expect } from "vitest";
import { getGatewayUrl, isProdSmoke } from "../utils/env";

const gateway = getGatewayUrl();

describe.skipIf(process.env.SKIP_GATEWAY_TESTS === "1")("Gateway API", () => {
  test.skipIf(isProdSmoke() && !process.env.TEST_GATEWAY_URL)(
    "GET /health returns JSON with status",
    async () => {
      const start = Date.now();
      const res = await fetch(`${gateway}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const ms = Date.now() - start;
      expect(ms).toBeLessThan(15_000);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { status?: string; service?: string };
      expect(body.status).toBeDefined();
      expect(String(body.status).toLowerCase()).toMatch(/healthy|ok|up/);
      if (body.service) {
        expect(typeof body.service).toBe("string");
      }
    }
  );

  test.skipIf(isProdSmoke())(
    "POST /rag/ask with empty body returns 4xx (validation)",
    async () => {
      const res = await fetch(`${gateway}/rag/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }
  );
});

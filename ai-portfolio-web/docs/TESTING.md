# Testing guide — semefit.com portfolio

## Prerequisites

- Node 18+
- **Playwright**: `npx playwright install chromium` (first time)
- **Local API tests**: Secure AI Gateway on `http://localhost:8000` (e.g. `docker compose up`), or set `SKIP_GATEWAY_TESTS=1` to skip Vitest API checks
- **Cypress / Playwright (local)**: Next.js dev server is started automatically via `start-server-and-test` (Cypress) and Playwright `webServer` (except prod smoke)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `TEST_BASE_URL` | Frontend origin. Local Playwright/Cypress default **`http://127.0.0.1:3001`** (dedicated port). |
| `PW_PORT` | Playwright dev server port (default `3001`) |
| `TEST_MODE=prod-smoke` | Opt-in production smoke mode (read-only) |
| `TEST_GATEWAY_URL` | Gateway for API tests in prod (e.g. public health URL). If unset in prod-smoke, API health test is skipped. |
| `SKIP_GATEWAY_TESTS=1` | Skip all Vitest gateway tests (local CI without backend) |
| `OPENAI_API_KEY` | Required for `testing:ai:*` scripts |

## Scheduled production report

**Workflow on `main`:** `.github/workflows/scheduled-prod-tests.yml` (template copy: [`docs/github-workflow-scheduled-prod-tests.yml`](./github-workflow-scheduled-prod-tests.yml)).

**Scheduled prod smoke & report**:

- Runs **every night** at **05:00 UTC** (plus **workflow_dispatch**)
- Runs Playwright **@prod-safe** and **Cypress** `prod-smoke` against `https://www.semefit.com`
- Commits `ai-portfolio-web/public/test-report/latest.json` (`[skip ci]`) with both runners’ status
- **`/testing/reports`** fetches that JSON from **GitHub raw** on each request, so new results show **without redeploying** the frontend

Override report URL (server only): **`TEST_REPORT_JSON_URL`** — must be **HTTPS** and host allowlisted (default: `raw.githubusercontent.com`). Add hosts via comma-separated **`TEST_REPORT_JSON_ALLOWED_HOSTS`** if needed.

If `main` is branch-protected, grant **Actions** write access to contents or use a PAT with `contents: write`.

The workflow uses **actions/checkout@v6** and **actions/setup-node@v5** (Node 24–compatible action runtimes) and **Node 22** for `npm`/Playwright/Cypress. The report step exits 0 on CI so the commit always runs; the last step fails the job if `overallOk` is false.

## Scripts

| Script | What it does |
|--------|----------------|
| `npm run test:playwright` | Full Playwright suite (Chromium desktop + mobile). Starts `npm run dev`. |
| `npm run test:playwright:prod` | **Prod smoke** against `https://www.semefit.com` — only tests tagged `@prod-safe` (GET navigations, no writes). |
| `npm run test:cypress` | Cypress e2e (journeys, footer). Starts dev server. |
| `npm run test:cypress:prod` | Cypress **prod smoke** — specs in `cypress/e2e/prod-smoke/` only. |
| `npm run test:api` | Vitest: `GET /health`, local `POST /rag/ask` validation error. |
| `npm run test:api:prod` | Vitest in prod-smoke: health only if `TEST_GATEWAY_URL` set; no POST. |
| `npm run test:integration` | Playwright: RAG error UI + eval shell when backend unreachable (local). |
| `npm run test:integration:prod` | Playwright prod: demo page shells (subset aligned with prod-safe demo smoke). |
| `npm run test:all` | `test:api` → `test:playwright` → `test:cypress` |
| `npm run testing:ai:suggest` | AI-suggested cases → `tests/reports/ai-test-suggestions.md` |
| `npm run testing:ai:triage` | Pipe logs: `npm run test:playwright 2>&1 \| node scripts/testing-ai/triage-failure.mjs` |
| `npm run testing:ai:gap` | Static + optional AI gap report → `tests/reports/ai-gap-analysis.md` |

## Production smoke — safety rules

1. **Opt-in**: set `TEST_BASE_URL=https://www.semefit.com` and `TEST_MODE=prod-smoke` (scripts bake this in for `:prod` targets).
2. **Read-only**: prod Playwright grep `@prod-safe` — no demo form submissions, no POST to gateway in automated prod API tests.
3. **Rate**: use modest workers; do not hammer the site.

## LinkedIn regression

Asserted in:

- Playwright prod: `live-report-hub.spec.ts`, `smoke-pages.spec.ts`, `testing-section.spec.ts`, etc.
- Cypress local: `contact-linkedin.cy.ts`, footer specs; prod nightly: `cypress/e2e/prod-smoke/core.cy.ts`

## Layout

```
tests/
  playwright/     # *.spec.ts
  api/            # Vitest
  utils/          # env + route-inventory.json
  reports/        # generated (gitignored)
cypress/e2e/
scripts/testing-ai/
```

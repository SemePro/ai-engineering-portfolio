/**
 * Static metadata for Testing pages — mirrors implemented suites (Phase 2).
 */
export const testSuiteMeta = {
  runModes: [
    {
      id: "local",
      name: "Local full suite",
      description:
        "Playwright (desktop + mobile), Cypress journeys, API + integration checks. Starts Next dev server automatically for Playwright.",
    },
    {
      id: "prod-smoke",
      name: "Production smoke (opt-in)",
      description:
        "Read-only GET navigations against https://www.semefit.com. No form posts, no demo submissions, no destructive API calls.",
    },
  ],
  suites: [
    {
      id: "playwright",
      name: "Playwright",
      areas: [
        "Navigation & core pages",
        "Testing section + subpages",
        "LinkedIn absence (contact, footer, multiple routes)",
        "UI integrity (header, footer, main)",
        "Demo page shells (h1 + layout)",
        "Mobile + desktop viewports (local)",
      ],
      commands: ["npm run test:playwright", "npm run test:playwright:prod"],
    },
    {
      id: "cypress",
      name: "Cypress",
      areas: [
        "User journeys (home → demo → projects)",
        "Testing hub flow",
        "Footer consistency",
        "Contact / LinkedIn regression",
        "Specs: cypress/e2e/local/ and cypress/e2e/prod-smoke/",
      ],
      commands: ["npm run test:cypress", "npm run test:cypress:prod"],
    },
    {
      id: "api",
      name: "API (Vitest)",
      areas: [
        "Gateway GET /health (schema + latency ceiling)",
        "POST validation error path (local only)",
      ],
      commands: ["npm run test:api", "npm run test:api:prod"],
    },
    {
      id: "integration",
      name: "Integration (Playwright)",
      areas: [
        "RAG demo error UI when gateway call fails (routed abort)",
        "Eval dashboard shell when runs API unavailable",
      ],
      commands: ["npm run test:integration", "npm run test:integration:prod"],
    },
  ],
  aiWorkflow: [
    {
      name: "Suggest tests",
      command: "npm run testing:ai:suggest",
      detail:
        "Uses route inventory + OpenAI to emit tests/reports/ai-test-suggestions.md",
    },
    {
      name: "Triage failures",
      command: "npm run testing:ai:triage",
      detail:
        "Pipe failing test output; writes tests/reports/ai-triage-*.md",
    },
    {
      name: "Gap analysis",
      command: "npm run testing:ai:gap",
      detail:
        "Static route vs spec scan; optional AI narrative in ai-gap-analysis.md",
    },
  ],
  scheduledReport: {
    page: "/testing/reports",
    workflow: "Scheduled prod smoke & report",
    note: "Nightly (05:00 UTC): job commits latest.json; /testing/reports loads it live from the repo.",
  },
} as const;

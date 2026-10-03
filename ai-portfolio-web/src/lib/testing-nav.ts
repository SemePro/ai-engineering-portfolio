/**
 * Single source for Testing IA: nav, footer, and landing cards.
 * Add or rename routes here to avoid drift across the site.
 */

export const TESTING_NAV_ITEMS = [
  { href: "/testing", navLabel: "Overview", footerLabel: "Overview" },
  {
    href: "/testing/automation",
    navLabel: "Automation",
    footerLabel: "Automation",
  },
  {
    href: "/testing/playwright",
    navLabel: "Playwright",
    footerLabel: "Playwright",
  },
  {
    href: "/testing/cypress",
    navLabel: "Cypress",
    footerLabel: "Cypress",
  },
  { href: "/testing/ui-tests", navLabel: "UI", footerLabel: "UI tests" },
  { href: "/testing/api-tests", navLabel: "API", footerLabel: "API tests" },
  {
    href: "/testing/integration-tests",
    navLabel: "Integration",
    footerLabel: "Integration",
  },
  {
    href: "/testing/reports",
    navLabel: "Reports",
    footerLabel: "Live report",
  },
] as const;

export type TestingLandingIconId =
  | "workflow"
  | "monitor"
  | "testTube"
  | "layers"
  | "network"
  | "bot";

export const TESTING_LANDING_CARDS: ReadonlyArray<{
  href: string;
  title: string;
  description: string;
  icon: TestingLandingIconId;
}> = [
  {
    href: "/testing/automation",
    title: "Automation",
    description:
      "Run modes, smoke vs regression, and confidence gating. Local full suite and production smoke.",
    icon: "workflow",
  },
  {
    href: "/testing/playwright",
    title: "Playwright",
    description:
      "Reliability and rendering: deterministic UI checks, cross-browser coverage, tracing.",
    icon: "monitor",
  },
  {
    href: "/testing/cypress",
    title: "Cypress",
    description:
      "User flows and interaction testing. Developer feedback loop and journey-style specs.",
    icon: "testTube",
  },
  {
    href: "/testing/ui-tests",
    title: "UI Testing",
    description:
      "Visual and layout correctness, page integrity, responsive rendering.",
    icon: "layers",
  },
  {
    href: "/testing/api-tests",
    title: "API Testing",
    description:
      "Contracts, schemas, error paths. Health and response validation for gateway-backed services.",
    icon: "network",
  },
  {
    href: "/testing/integration-tests",
    title: "Integration Testing",
    description:
      "System behavior: frontend through gateway to backend, dependencies and failure modes.",
    icon: "bot",
  },
  {
    href: "/testing/reports",
    title: "Reports",
    description:
      "Nightly production smoke results, pass rate, and run history. Live from repo.",
    icon: "network",
  },
];

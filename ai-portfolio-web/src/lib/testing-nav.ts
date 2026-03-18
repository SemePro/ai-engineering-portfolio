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
    title: "Automation Testing",
    description:
      "Smoke, regression, and critical workflows with confidence gating across the stack.",
    icon: "workflow",
  },
  {
    href: "/testing/playwright",
    title: "Playwright",
    description:
      "Cross-browser UI coverage, tracing, and resilient selectors for the Next.js portfolio.",
    icon: "monitor",
  },
  {
    href: "/testing/cypress",
    title: "Cypress",
    description:
      "E2E journeys, API interception, and fast feedback on user flows and demos.",
    icon: "testTube",
  },
  {
    href: "/testing/ui-tests",
    title: "UI Testing",
    description:
      "Header, layout, responsive rendering, and route-level UI validation.",
    icon: "layers",
  },
  {
    href: "/testing/api-tests",
    title: "API Testing",
    description:
      "Health, schema shape, errors, and consistency for gateway-backed AI services.",
    icon: "network",
  },
  {
    href: "/testing/integration-tests",
    title: "Integration Testing",
    description:
      "Frontend through gateway to backend: end-to-end system behavior and fallbacks.",
    icon: "bot",
  },
];

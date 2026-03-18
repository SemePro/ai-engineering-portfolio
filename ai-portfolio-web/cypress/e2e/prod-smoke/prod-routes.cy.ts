/**
 * One assertion per public route — mirrors breadth of Playwright @prod-safe smoke.
 */
const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/projects",
  "/architecture",
  "/demo",
  "/demo/gateway",
  "/demo/rag",
  "/demo/eval",
  "/demo/architecture",
  "/demo/devops",
  "/demo/incident",
  "/testing",
  "/testing/automation",
  "/testing/playwright",
  "/testing/cypress",
  "/testing/ui-tests",
  "/testing/api-tests",
  "/testing/integration-tests",
  "/testing/reports",
  "/projects/architecture",
  "/projects/devops",
  "/projects/incident",
];

describe("Prod routes @prod-safe", () => {
  ROUTES.forEach((path) => {
    it(`main visible on ${path}`, () => {
      cy.visit(path);
      cy.get("main").should("be.visible");
    });
  });
});

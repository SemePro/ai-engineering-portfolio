/**
 * Read-only smoke against production. Run with:
 * TEST_BASE_URL=https://www.semefit.com npm run test:cypress:prod
 */
describe("Prod smoke @prod-safe", () => {
  it("home and testing overview", () => {
    cy.visit("/");
    cy.contains("h1", /Applied AI Engineering Portfolio/i);
    cy.visit("/testing");
    cy.contains("h1", /^Testing$/);
  });

  it("no LinkedIn on contact and home", () => {
    cy.visit("/contact");
    cy.get('a[href*="linkedin"]').should("not.exist");
    cy.visit("/");
    cy.get('a[href*="linkedin"]').should("not.exist");
  });

  it("main routes respond", () => {
    for (const path of ["/projects", "/demo", "/about", "/architecture"]) {
      cy.visit(path);
      cy.get("main").should("be.visible");
    }
  });
});

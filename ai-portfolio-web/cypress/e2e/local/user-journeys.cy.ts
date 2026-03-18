describe("User journeys (local)", () => {
  it("walks main sections from home", () => {
    cy.visit("/");
    cy.contains("h1", /Applied AI Engineering Portfolio/i);
    cy.get('a[href="/demo"]').first().click();
    cy.url().should("include", "/demo");
    cy.visit("/projects");
    cy.contains("h1", /Projects/i);
    cy.visit("/architecture");
    cy.contains("h1", /Architecture/i);
  });

  it("visits testing area and returns home", () => {
    cy.visit("/testing");
    cy.get("main").find("h1").first().should("contain.text", "Testing");
    cy.contains("main a", "Read more").first().click();
    cy.url().should("match", /\/testing\//);
    cy.visit("/");
    cy.contains("h1", /Applied AI Engineering Portfolio/i);
  });

  it("opens demo hub and a demo card path", () => {
    cy.visit("/demo");
    cy.contains("h1", /Live Demonstrations/i);
    cy.get('a[href="/demo/rag"]').first().click();
    cy.url().should("include", "/demo/rag");
    cy.contains("h1", /RAG Knowledge Assistant/i);
  });

  it("project cards link to demos", () => {
    cy.visit("/projects");
    cy.get('a[href^="/demo/"]').first().click();
    cy.url().should("match", /\/demo\//);
  });

  it("testing landing shows area cards", () => {
    cy.visit("/testing");
    cy.contains("h2", /Areas/i);
    cy.contains(/Automation Testing/i);
    cy.contains(/Playwright/i);
    cy.contains(/Cypress/i);
  });
});

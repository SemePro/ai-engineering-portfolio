describe("Contact & LinkedIn (local)", () => {
  it("contact shows GitHub, never LinkedIn", () => {
    cy.visit("/contact");
    cy.contains("h1", /Contact/i);
    cy.contains("a", /GitHub/i).should("exist");
    cy.get('a[href*="linkedin"]').should("not.exist");
    cy.contains(/LinkedIn/i).should("not.exist");
  });
});

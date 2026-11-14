describe("Contact links (local)", () => {
  it("contact shows GitHub and no placeholder links", () => {
    cy.visit("/contact");
    cy.contains("h1", /Contact/i);
    cy.contains("a", /GitHub/i).should("exist");
    // Résumé / LinkedIn / email render only when configured in src/lib/profile.ts
    cy.get('a[href="#"], a[href=""], a[href*="example.com"], a[href="https://github.com"]').should("not.exist");
  });
});

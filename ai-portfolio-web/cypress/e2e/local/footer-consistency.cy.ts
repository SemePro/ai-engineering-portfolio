describe("Footer consistency (local)", () => {
  const pages = ["/", "/about", "/testing", "/contact"];

  pages.forEach((path) => {
    it(`footer has Testing + Projects on ${path}`, () => {
      cy.visit(path);
      cy.get("footer").within(() => {
        cy.contains("h4", "Testing").should("exist");
        cy.contains("h4", "Projects").should("exist");
        cy.get('a[href*="linkedin"]').should("not.exist");
      });
    });
  });
});

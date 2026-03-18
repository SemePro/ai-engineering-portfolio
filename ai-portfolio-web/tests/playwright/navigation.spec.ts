import { test, expect } from "@playwright/test";

async function openNavIfMobile(page: import("@playwright/test").Page, projectName: string) {
  if (projectName === "mobile") {
    await page.getByRole("button", { name: /open menu/i }).click();
  }
}

test.describe("Main nav @prod-safe", () => {
  test("nav links reach targets @prod-safe", async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "mobile";

    await page.goto("/");
    await openNavIfMobile(page, testInfo.project.name);

    const projects = mobile
      ? page.getByRole("region", { name: /Mobile navigation/i }).getByRole("link", { name: "Projects" })
      : page.getByRole("navigation", { name: /Main/i }).getByRole("link", { name: "Projects" });
    await projects.click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goto("/");
    await openNavIfMobile(page, testInfo.project.name);
    const demos = mobile
      ? page.getByRole("region", { name: /Mobile navigation/i }).getByRole("link", { name: "Demos" })
      : page.getByRole("navigation", { name: /Main/i }).getByRole("link", { name: "Demos" });
    await demos.click();
    await expect(page).toHaveURL(/\/demo$/);

    await page.goto("/");
    await openNavIfMobile(page, testInfo.project.name);
    const testing = mobile
      ? page.getByRole("region", { name: /Mobile navigation/i }).getByRole("link", { name: "Testing" })
      : page.getByRole("navigation", { name: /Main/i }).getByRole("link", { name: "Testing" });
    await testing.click();
    await expect(page).toHaveURL(/\/testing$/);
  });
});

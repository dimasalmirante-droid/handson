import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, hasStudent, logIn, student } from "./helpers";

/** Module 2 Step 1: workspace routing, legal pages and sign-out. */
test.describe("workspaces and legal pages", () => {
  for (const path of ["/start", "/workspaces", "/employer/11111111-1111-4111-8111-111111111111", "/legal/accept"]) {
    test(`signed-out visitors are sent to login from ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/);
    });
  }

  test("the Terms and the Privacy Notice can be read without signing in @mobile", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Terms and Conditions");
    await expectNoHorizontalScroll(page);
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Privacy Notice");
  });

  test("unknown legal documents return 404", async ({ page }) => {
    const res = await page.goto("/legal/cookies");
    expect(res?.status()).toBe(404);
  });

  test("the sign-out link never leads to a protected page when signed out", async ({ page }) => {
    await page.goto("/auth/signout");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the sign-out confirmation page is public", async ({ page }) => {
    await page.goto("/signout");
    await expect(page.getByRole("heading", { name: "Sign out of Handson?" })).toBeVisible();
  });
});

test.describe("workspaces for a signed-in student", () => {
  test.skip(!hasStudent, "Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD to run");

  test("someone else's employer workspace returns 404", async ({ page }) => {
    await logIn(page, student);
    const res = await page.goto("/employer/11111111-1111-4111-8111-111111111111");
    expect(res?.status()).toBe(404);
  });

  test("the site root and login page send a signed-in student to their workspace", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/");
    await expect(page).toHaveURL(/\/(onboarding|dashboard)/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/(onboarding|dashboard)/);
  });

  test("the sign-out link shows a confirmation instead of a protected page", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/auth/signout");
    await expect(page).toHaveURL(/\/signout$/);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed-out/);
  });
});

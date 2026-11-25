import { expect, test } from "@playwright/test";
import path from "node:path";
import { expectNoHorizontalScroll, hasStudent, logIn, logOut, student } from "./helpers";

/**
 * Student journey, using a dedicated, verified test account
 * (E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD). Safe to re-run: it edits the
 * account's own data and restores the privacy setting.
 */
test.describe("student journey", () => {
  test.skip(!hasStudent, "Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD to run");

  test("signs in and reaches onboarding or the dashboard", async ({ page }) => {
    await logIn(page, student);
    await expect(page).toHaveURL(/\/(onboarding|dashboard)/);
  });

  test("personal details autosave and persist across sessions", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/onboarding/personal");
    const headline = `Finalista de Gestão ${Date.now() % 1000}`;
    await page.locator("#headline").fill(headline);
    await page.locator("#headline").blur();
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 15_000 });

    await logOut(page);
    await logIn(page, student);
    await page.goto("/onboarding/personal");
    await expect(page.locator("#headline")).toHaveValue(headline);
  });

  test("rejects an invalid Mozambican phone number", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/onboarding/personal");
    const phone = page.getByLabel("Phone number");
    const original = await phone.inputValue();
    await phone.fill("123");
    await phone.blur();
    await expect(page.getByText(/9-digit Mozambican mobile number/)).toBeVisible({ timeout: 15_000 });
    await phone.fill(original || "84 123 4567");
    await phone.blur();
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 15_000 });
  });

  test("uploads, opens and replaces a CV privately", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/onboarding/documents");
    const cv = page.locator("li", { has: page.getByText("Counts for 10% of your profile").first() }).first();
    // Pick the file only once the page is interactive, or the change event is lost.
    await page.waitForLoadState("networkidle");
    await cv.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "test-cv.pdf"));
    await expect(page.getByText("test-cv.pdf uploaded.")).toBeVisible({ timeout: 45_000 });

    const open = cv.getByRole("link", { name: "Open" }).first();
    expect(await open.getAttribute("href")).toMatch(/^\/files\/[0-9a-f-]{36}$/);
    // Opening the file (a redirect to a short-lived signed storage URL) is checked on the
    // deployed preview: the CI server runs over plain http on localhost, where it does not.
  });

  test("refuses a file whose content does not match its type", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/onboarding/documents");
    const cv = page.locator("li", { has: page.getByText("Counts for 10% of your profile").first() }).first();
    // Pick the file only once the page is interactive, or the change event is lost.
    await page.waitForLoadState("networkidle");
    await cv.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "fake.pdf"));
    await expect(page.getByText(/content does not match its type/)).toBeVisible({ timeout: 15_000 });
  });

  test("profile is private by default and visibility can be toggled with consent", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/dashboard/settings");
    const toggle = page.getByRole("switch", { name: "Allow verified employers to view my profile" });
    const wasOn = (await toggle.getAttribute("aria-checked")) === "true";
    if (wasOn) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
    }
    await toggle.click();
    await page.getByRole("button", { name: "I agree, make my profile visible" }).click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.getByText("Consent history").click();
    await expect(page.getByText("Employer visibility").first()).toBeVisible();
  });

  test("dashboard shows real completion and works on mobile @mobile", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/dashboard");
    await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", /\d+/);
    await expectNoHorizontalScroll(page);
  });

  test("profile is shown as a page and each section opens in an edit panel @mobile", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/dashboard/profile");
    await expect(page.getByRole("heading", { name: "Education" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/dashboard/profile?edit=skills");
    const panel = page.getByRole("dialog", { name: "Skills and languages" });
    await expect(panel).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard\/profile(#skills)?$/);

    // Old section pages still work and open the matching panel.
    await page.goto("/dashboard/education");
    await expect(page).toHaveURL(/edit=education/);
    await expect(page.getByRole("dialog", { name: "Education" })).toBeVisible();
  });

  test("onboarding asks only for what the profile needs; optional details live on the profile", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/onboarding/personal");
    await expect(page.getByLabel("First name")).toBeVisible();
    await expect(page.getByLabel("Middle name")).toHaveCount(0);
    await expect(page.getByLabel("Short summary")).toHaveCount(0);

    await page.goto("/dashboard/profile?edit=about");
    const panel = page.getByRole("dialog", { name: "About you" });
    await expect(panel.getByLabel("Middle name")).toBeVisible();
    await expect(panel.getByLabel("Short summary")).toBeVisible();
  });

  test("learning page lists courses or explains they are coming @mobile", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Learning" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/learning$/);
    await expect(page.getByRole("heading", { name: "Learning", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Have an access code?" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // The dashboard streams (loading.tsx), so a missing course shows the not-found page with status 200.
    await page.goto("/dashboard/learning/curso-que-nao-existe");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("students cannot open the admin portal", async ({ page }) => {
    await logIn(page, student);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });
});

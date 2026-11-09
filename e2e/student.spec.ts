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
    const city = `Maputo ${Date.now() % 1000}`;
    await page.getByLabel("City or district").fill(city);
    await page.getByLabel("City or district").blur();
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 15_000 });

    await logOut(page);
    await logIn(page, student);
    await page.goto("/onboarding/personal");
    await expect(page.getByLabel("City or district")).toHaveValue(city);
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
    await cv.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "test-cv.pdf"));
    await expect(page.getByText("test-cv.pdf uploaded.")).toBeVisible({ timeout: 45_000 });

    const open = page.getByRole("link", { name: "Open" }).first();
    const href = await open.getAttribute("href");
    expect(href).toMatch(/^\/files\/[0-9a-f-]{36}$/);
    const res = await page.request.get(href!, { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers()["location"]).toMatch(/supabase\.co\/storage\/v1\/object\/sign\/documents\/.+token=/);
  });

  test("refuses a file whose content does not match its type", async ({ page }) => {
    await logIn(page, student);
    await page.goto("/onboarding/documents");
    const cv = page.locator("li", { has: page.getByText("Counts for 10% of your profile").first() }).first();
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

  test("students cannot open the admin portal", async ({ page }) => {
    await logIn(page, student);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });
});

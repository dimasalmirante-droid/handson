import { expect, test } from "@playwright/test";
import { hasAdmin, hasStudent, admin, logIn, student } from "./helpers";

/** Admin journey, using an administrator test account (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD). Read-only. */
test.describe("admin journey", () => {
  test.skip(!hasAdmin, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run");

  test("administrators land on the admin overview", async ({ page }) => {
    await logIn(page, admin);
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Registered students")).toBeVisible();
  });

  test("search, filter and open a student profile", async ({ page }) => {
    test.skip(!hasStudent, "Needs the student test account to search for");
    await logIn(page, admin);
    await page.goto("/admin/students");
    await page.getByPlaceholder("Search by name, email or phone").fill(student.email);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=/);
    const row = page.getByRole("row").filter({ hasText: student.email });
    await expect(row).toHaveCount(1);
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/admin\/students\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Profile verification" })).toBeVisible();
  });

  test("CSV export downloads for administrators", async ({ page }) => {
    await logIn(page, admin);
    await page.goto("/admin/students");
    const link = page.getByRole("link", { name: "Export CSV" });
    test.skip((await link.count()) === 0, "Export needs the admin role or above and at least one student");
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toMatch(/^handson-students-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

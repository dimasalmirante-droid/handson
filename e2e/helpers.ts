import { expect, type Page } from "@playwright/test";

export const student = {
  email: process.env.E2E_STUDENT_EMAIL ?? "",
  password: process.env.E2E_STUDENT_PASSWORD ?? "",
};
export const admin = {
  email: process.env.E2E_ADMIN_EMAIL ?? "",
  password: process.env.E2E_ADMIN_PASSWORD ?? "",
};
export const hasStudent = !!(student.email && student.password);
export const hasAdmin = !!(admin.email && admin.password);

export async function logIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(who.email);
  await page.getByLabel("Password", { exact: false }).first().fill(who.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

export async function logOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login/);
}

/** The page should not scroll sideways (layout fits the screen). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

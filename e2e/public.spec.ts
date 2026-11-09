import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

test.describe("public pages @mobile", () => {
  test("start page offers registration and login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your profile" })).toHaveAttribute("href", "/register");
    await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    await expectNoHorizontalScroll(page);
  });

  test("registration page shows both sign-up options", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("registration validation", () => {
  test("rejects invalid input on the server with clear messages", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("First name").fill("Amina");
    await page.getByLabel("Email address").fill("amina@");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your surname.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page.getByText("You must accept the Terms and Conditions to continue.")).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveValue("Amina");
  });

  test("password reset form validates the email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });
});

test.describe("access control", () => {
  for (const path of ["/dashboard", "/dashboard/settings", "/onboarding/personal", "/admin", "/admin/students"]) {
    test(`signed-out visitors are sent to login from ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    });
  }

  test("document links require sign-in", async ({ page }) => {
    await page.goto("/files/00000000-0000-4000-8000-000000000000");
    await expect(page).toHaveURL(/\/login/);
  });

  test("CSV export requires sign-in", async ({ request }) => {
    const res = await request.get("/admin/students/export", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
  });

  test("expired or invalid email links show a helpful message", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=invalid&type=recovery");
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(page.getByText("That link is invalid or has expired.")).toBeVisible();
  });

  test("unknown pages return a 404 page", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

test.describe("security headers", () => {
  test("are sent on every page", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("pages load without Content Security Policy violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    for (const path of ["/", "/login", "/register", "/forgot-password"]) await page.goto(path);
    expect(violations).toEqual([]);
  });
});

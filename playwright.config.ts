import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 *   E2E_BASE_URL       Site to test. Defaults to a local production build on :3100.
 *   E2E_STUDENT_EMAIL  A verified email/password student account (optional).
 *   E2E_STUDENT_PASSWORD
 *   E2E_ADMIN_EMAIL    An account with an administrator role (optional).
 *   E2E_ADMIN_PASSWORD
 *
 * Public and security tests always run. Student and admin journeys run only
 * when their credentials are set, and use dedicated test accounts.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100";
const local = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: local
    ? {
        command: "npm run build && npm start -- -p 3100",
        url: "http://localhost:3100/login",
        timeout: 240_000,
        reuseExistingServer: true,
      }
    : undefined,
});

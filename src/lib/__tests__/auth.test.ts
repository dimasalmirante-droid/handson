import { describe, expect, it } from "vitest";
import { isGuestOnlyPath, isProtectedPath, safeNextPath } from "../auth/redirects";
import { loginSchema, registerSchema, resetPasswordSchema } from "../validation/auth";

describe("safeNextPath", () => {
  it("accepts same-site relative paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/onboarding?step=2")).toBe("/onboarding?step=2");
  });

  it("rejects open-redirect attempts", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "/x\r\nLocation: y", "/auth/callback"]) {
      expect(safeNextPath(bad, "/fallback")).toBe("/fallback");
    }
  });

  it("falls back when empty", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("", "/onboarding")).toBe("/onboarding");
  });
});

describe("route classification", () => {
  it("protects app routes", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/documents")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/admin/students")).toBe(true);
    expect(isProtectedPath("/dashboarding")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("identifies guest-only pages", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/register")).toBe(true);
    expect(isGuestOnlyPath("/reset-password")).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    firstName: "Amina",
    surname: "Macuácua",
    email: "  Amina@Example.com ",
    password: "segura2026",
    acceptTerms: "on",
  };

  it("accepts valid input and normalises email", () => {
    const r = registerSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("amina@example.com");
  });

  it("accepts Portuguese names with accents, hyphens and apostrophes", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "João-Maria", surname: "D'Almeida Simão" }).success).toBe(true);
  });

  it("requires accepting the terms", () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: "" }).success).toBe(false);
  });

  it("enforces password rules", () => {
    for (const password of ["short1", "onlyletters", "12345678"]) {
      expect(registerSchema.safeParse({ ...valid, password }).success).toBe(false);
    }
  });

  it("rejects invalid emails and names", () => {
    expect(registerSchema.safeParse({ ...valid, email: "amina@" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, firstName: "<script>" }).success).toBe(false);
  });
});

describe("loginSchema and resetPasswordSchema", () => {
  it("requires email and password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("requires matching passwords", () => {
    expect(resetPasswordSchema.safeParse({ password: "segura2026", confirmPassword: "segura2027" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "segura2026", confirmPassword: "segura2026" }).success).toBe(true);
  });
});

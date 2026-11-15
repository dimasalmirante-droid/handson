import { describe, expect, it } from "vitest";
import { firstCompanyAdminInvitationSchema } from "./validation";

describe("firstCompanyAdminInvitationSchema", () => {
  it("normalises the email and trims names", () => {
    expect(
      firstCompanyAdminInvitationSchema.parse({
        email: "  PEOPLE.LEAD@Example.COM ",
        fullName: "  Ana Cossa  ",
        jobTitle: "  People Director  ",
      }),
    ).toEqual({
      email: "people.lead@example.com",
      fullName: "Ana Cossa",
      jobTitle: "People Director",
    });
  });

  it("allows an optional job title", () => {
    expect(
      firstCompanyAdminInvitationSchema.parse({
        email: "admin@example.com",
        fullName: "Joao Muianga",
        jobTitle: " ",
      }).jobTitle,
    ).toBeNull();
  });

  it.each(["", "not-an-email", "person@", "person@example"] as const)(
    "rejects an invalid email address: %s",
    (email) => {
      expect(firstCompanyAdminInvitationSchema.safeParse({
        email,
        fullName: "Ana Cossa",
        jobTitle: "",
      }).success).toBe(false);
    },
  );

  it("requires a full name and enforces database field limits", () => {
    expect(firstCompanyAdminInvitationSchema.safeParse({
      email: "admin@example.com",
      fullName: "A",
      jobTitle: "",
    }).success).toBe(false);

    expect(firstCompanyAdminInvitationSchema.safeParse({
      email: "admin@example.com",
      fullName: "A".repeat(201),
      jobTitle: "",
    }).success).toBe(false);

    expect(firstCompanyAdminInvitationSchema.safeParse({
      email: "a".repeat(310) + "@example.com",
      fullName: "Ana Cossa",
      jobTitle: "",
    }).success).toBe(false);
  });
});

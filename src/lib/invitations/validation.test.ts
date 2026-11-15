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


describe("companyTeamInvitationSchema", () => {
  it("normalises the email and trims the colleague details", async () => {
    const { companyTeamInvitationSchema } = await import("./validation");
    expect(companyTeamInvitationSchema.parse({
      email: "  TEAM.LEAD@Example.COM ",
      fullName: "  Ana Cossa  ",
      jobTitle: "  People Manager  ",
      role: "reviewer",
    })).toEqual({
      email: "team.lead@example.com",
      fullName: "Ana Cossa",
      jobTitle: "People Manager",
      role: "reviewer",
    });
  });

  it("accepts Company Administrator and makes the job title optional", async () => {
    const { companyTeamInvitationSchema } = await import("./validation");
    expect(companyTeamInvitationSchema.parse({
      email: "admin@example.com",
      fullName: "Joao Muianga",
      jobTitle: " ",
      role: "company_admin",
    }).jobTitle).toBeNull();
  });

  it("rejects invalid roles, emails and incomplete names", async () => {
    const { companyTeamInvitationSchema } = await import("./validation");
    const base = { email: "ana@example.com", fullName: "Ana Cossa", jobTitle: "", role: "reviewer" };
    expect(companyTeamInvitationSchema.safeParse({ ...base, role: "editor" }).success).toBe(false);
    expect(companyTeamInvitationSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(companyTeamInvitationSchema.safeParse({ ...base, fullName: "A" }).success).toBe(false);
    expect(companyTeamInvitationSchema.safeParse({ ...base, fullName: "A".repeat(201) }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { firstCompanyAdminInvitationEmail } from "./email-content";

describe("firstCompanyAdminInvitationEmail", () => {
  it("includes the company, invitee, link and expiry in plain text and HTML", () => {
    const email = firstCompanyAdminInvitationEmail({
      companyName: "Vodacom Moçambique",
      fullName: "Ana Cossa",
      inviteUrl: "https://preview.handson.cloud/invite/secure-token",
      expiresAt: new Date("2026-11-22T10:00:00.000Z"),
    });

    expect(email.subject).toContain("Vodacom Moçambique");
    expect(email.text).toContain("Ana Cossa");
    expect(email.text).toContain("https://preview.handson.cloud/invite/secure-token");
    expect(email.text).toContain("22 November 2026");
    expect(email.html).toContain("Vodacom Moçambique");
    expect(email.html).toContain("https://preview.handson.cloud/invite/secure-token");
  });

  it("escapes untrusted company and invitee names in HTML", () => {
    const email = firstCompanyAdminInvitationEmail({
      companyName: "<script>alert(1)</script> & Co.",
      fullName: "Ana <img src=x onerror=alert(1)>",
      inviteUrl: "https://handson.cloud/invite/secure-token",
      expiresAt: new Date("2026-11-22T10:00:00.000Z"),
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img");
    expect(email.text).toContain("<script>");
  });
});


describe("companyTeamInvitationEmail", () => {
  it.each([
    ["reviewer", "Reviewer"],
    ["company_admin", "Company Administrator"],
  ] as const)("identifies the assigned role %s in the email", async (role, label) => {
    const { companyTeamInvitationEmail } = await import("./email-content");
    const email = companyTeamInvitationEmail({
      companyName: "Vodacom Moçambique",
      fullName: "Ana Cossa",
      role,
      inviteUrl: "https://preview.handson.cloud/invite/secure-token",
      expiresAt: new Date("2026-11-22T10:00:00.000Z"),
    });

    expect(email.subject).toContain("Vodacom Moçambique");
    expect(email.text).toContain("as a " + label);
    expect(email.html).toContain("<strong>" + label + "</strong>");
    expect(email.text).toContain("https://preview.handson.cloud/invite/secure-token");
    expect(email.text).toContain("22 November 2026");
  });

  it("escapes untrusted colleague and company names in invitation HTML", async () => {
    const { companyTeamInvitationEmail } = await import("./email-content");
    const email = companyTeamInvitationEmail({
      companyName: "<script>alert(1)</script> & Co.",
      fullName: "Ana <img src=x onerror=alert(1)>",
      role: "reviewer",
      inviteUrl: "https://handson.cloud/invite/secure-token",
      expiresAt: new Date("2026-11-22T10:00:00.000Z"),
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img");
  });
});

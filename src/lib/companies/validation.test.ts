import { describe, expect, it } from "vitest";
import { companyRegistrationSchema, suggestCompanySlug } from "./validation";

describe("suggestCompanySlug", () => {
  it.each([
    ["Sabor Doce", "sabor-doce"],
    ["Vodacom Moçambique", "vodacom-mocambique"],
    ["Pão & Companhia", "pao-companhia"],
    ["  ACME, Lda.  ", "acme-lda"],
    ["Several   spaces", "several-spaces"],
    ["!!!", ""],
  ])("suggests a clean slug for %s", (name, expected) => {
    expect(suggestCompanySlug(name)).toBe(expected);
  });

  it("limits suggestions to 80 characters without leaving a trailing hyphen", () => {
    expect(suggestCompanySlug(`${"a".repeat(79)} b`)).toBe("a".repeat(80));
  });
});

describe("companyRegistrationSchema", () => {
  it("trims the company name, normalises the slug and clears an empty note", () => {
    expect(
      companyRegistrationSchema.parse({
        name: "  Example Mozambique, S.A.  ",
        slug: "  Example-Mozambique  ",
        note: "   ",
      }),
    ).toEqual({
      name: "Example Mozambique, S.A.",
      slug: "example-mozambique",
      note: null,
    });
  });

  it("accepts a bounded internal setup note", () => {
    const result = companyRegistrationSchema.parse({
      name: "Example Lda",
      slug: "example",
      note: "Contract signed; awaiting contact details.",
    });
    expect(result.note).toBe("Contract signed; awaiting contact details.");
  });

  it.each(["", "a", "two words", "two--hyphens", "-leading", "trailing-", "UPPER CASE"])(
    "rejects an invalid public page slug: %s",
    (slug) => {
      expect(
        companyRegistrationSchema.safeParse({ name: "Example Lda", slug, note: "" }).success,
      ).toBe(false);
    },
  );

  it("rejects a company name that is too short", () => {
    expect(
      companyRegistrationSchema.safeParse({ name: " X ", slug: "example", note: "" }).success,
    ).toBe(false);
  });

  it("rejects an internal note above the database limit", () => {
    expect(
      companyRegistrationSchema.safeParse({ name: "Example Lda", slug: "example", note: "x".repeat(5001) }).success,
    ).toBe(false);
  });
});

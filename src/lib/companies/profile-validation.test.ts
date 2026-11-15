import { describe, expect, it } from "vitest";
import { companyProfileSchema } from "./profile-validation";

const valid = {
  name: "Sabor Doce",
  contactEmail: "  HR@SABORDOCE.MZ ",
  description: "  We make baked goods and confectionery. ",
  website: "https://sabordoce.mz",
  industryId: "4",
  countryCode: " mz ",
  province: " Maputo ",
  city: " Matola ",
  businessPhone: "+258841234567",
};

describe("companyProfileSchema", () => {
  it("normalises and trims the company profile fields", () => {
    expect(companyProfileSchema.parse(valid)).toEqual({
      name: "Sabor Doce",
      contactEmail: "hr@sabordoce.mz",
      description: "We make baked goods and confectionery.",
      website: "https://sabordoce.mz",
      industryId: 4,
      countryCode: "MZ",
      province: "Maputo",
      city: "Matola",
      businessPhone: "+258841234567",
    });
  });

  it("allows optional company details to remain empty", () => {
    expect(companyProfileSchema.parse({
      name: "Example Ltd",
      contactEmail: "",
      description: "",
      website: "",
      industryId: "",
      countryCode: "",
      province: "",
      city: "",
      businessPhone: "",
    })).toEqual({
      name: "Example Ltd",
      contactEmail: null,
      description: null,
      website: null,
      industryId: null,
      countryCode: null,
      province: null,
      city: null,
      businessPhone: null,
    });
  });

  it.each(["http://example.com", "example.com", "https://has spaces.example.com"])(
    "rejects website URLs that are not valid HTTPS values: %s",
    (website) => {
      expect(companyProfileSchema.safeParse({ ...valid, website }).success).toBe(false);
    },
  );

  it("rejects invalid contact details and country codes", () => {
    expect(companyProfileSchema.safeParse({ ...valid, contactEmail: "not-email" }).success).toBe(false);
    expect(companyProfileSchema.safeParse({ ...valid, countryCode: "MOZ" }).success).toBe(false);
    expect(companyProfileSchema.safeParse({ ...valid, businessPhone: "0841234567" }).success).toBe(false);
  });

  it("enforces company and description limits", () => {
    expect(companyProfileSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
    expect(companyProfileSchema.safeParse({ ...valid, description: "x".repeat(2001) }).success).toBe(false);
  });
});

import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer.`).transform((value) => value || null);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value || null)
  .refine((value) => value === null || z.string().email().max(320).safeParse(value).success, "Enter a valid official company email address.");

const optionalWebsite = z
  .string()
  .trim()
  .transform((value) => value || null)
  .refine(
    (value) => {
      if (value === null || value.length > 300) return value === null;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    "Enter a valid HTTPS website address.",
  );

const optionalPhone = z
  .string()
  .trim()
  .transform((value) => value || null)
  .refine((value) => value === null || /^\+[1-9][0-9]{7,14}$/.test(value), "Enter an international phone number without spaces, for example +258841234567.");

const optionalCountryCode = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value || null)
  .refine((value) => value === null || /^[A-Z]{2}$/.test(value), "Use a two-letter country code, for example MZ or ZA.");

const optionalIndustryId = z
  .string()
  .trim()
  .transform((value) => value ? Number(value) : null)
  .refine((value) => value === null || (Number.isSafeInteger(value) && value > 0 && value <= 32767), "Choose an industry from the list.");

export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter a company name with at least 2 characters.").max(200, "Company names must be 200 characters or fewer."),
  contactEmail: optionalEmail,
  description: optionalText(2000),
  website: optionalWebsite,
  industryId: optionalIndustryId,
  countryCode: optionalCountryCode,
  province: optionalText(100),
  city: optionalText(100),
  businessPhone: optionalPhone,
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

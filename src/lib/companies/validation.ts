import { z } from "zod";

const COMPANY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Build a URL-safe suggestion for the employer's future public page slug. */
export function suggestCompanySlug(companyName: string): string {
  return companyName
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const companyRegistrationSchema = z.object({
  name: z.string().trim().min(2, "Enter a company name with at least 2 characters.").max(200, "Company names must be 200 characters or fewer."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Enter a public page slug with at least 2 characters.")
    .max(80, "The public page slug must be 80 characters or fewer.")
    .regex(COMPANY_SLUG, "Use lower-case letters, numbers and single hyphens for the public page slug."),
  note: z.string().trim().max(5000, "The internal note must be 5,000 characters or fewer.").transform((value) => value || null),
});

export type CompanyRegistration = z.infer<typeof companyRegistrationSchema>;

import { z } from "zod";

const COMPANY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

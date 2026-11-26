import { z } from "zod";

export const firstCompanyAdminInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(320, "The email address must be 320 characters or fewer."),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the administrator's full name.")
    .max(200, "The name must be 200 characters or fewer."),
  jobTitle: z
    .string()
    .trim()
    .max(200, "The job title must be 200 characters or fewer.")
    .transform((value) => value || null),
});

export type FirstCompanyAdminInvitation = z.infer<typeof firstCompanyAdminInvitationSchema>;


export const companyTeamInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(320, "The email address must be 320 characters or fewer."),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the colleague's full name.")
    .max(200, "The name must be 200 characters or fewer."),
  jobTitle: z
    .string()
    .trim()
    .max(200, "The job title must be 200 characters or fewer.")
    .transform((value) => value || null),
  role: z.enum(["reviewer", "company_admin"]),
});

export type CompanyTeamInvitation = z.infer<typeof companyTeamInvitationSchema>;

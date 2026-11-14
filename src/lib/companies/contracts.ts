import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, label)
    .transform((value) => value || null);

export const companyContractRegistrationSchema = z
  .object({
    reference: optionalText(120, "The contract reference must be 120 characters or fewer."),
    signedOn: z.iso.date(),
    startsOn: z.iso.date(),
    endsOn: z.union([z.iso.date(), z.literal("")]).transform((value) => value || null),
    serviceScope: z
      .string()
      .trim()
      .min(1, "Describe the services covered by this contract.")
      .max(5000, "The service scope must be 5,000 characters or fewer."),
    internalNote: optionalText(2000, "The internal note must be 2,000 characters or fewer."),
  })
  .superRefine((value, ctx) => {
    if (value.endsOn && value.endsOn < value.startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "The contract end date cannot be before its start date.",
      });
    }
  });

export type CompanyContractRegistration = z.infer<typeof companyContractRegistrationSchema>;

export type CompanyContractStatus = "scheduled" | "active" | "expired" | "terminated";

export function getCompanyContractStatus(
  contract: { startsOn: string; endsOn: string | null; terminatedAt: string | null },
  today: string,
): CompanyContractStatus {
  if (contract.terminatedAt) return "terminated";
  if (contract.endsOn && contract.endsOn < today) return "expired";
  if (contract.startsOn > today) return "scheduled";
  return "active";
}

import { describe, expect, it } from "vitest";
import { companyContractRegistrationSchema, getCompanyContractStatus } from "./contracts";

const validContract = {
  reference: "  HR-2026-01  ",
  signedOn: "2026-11-10",
  startsOn: "2026-12-01",
  endsOn: "2027-11-30",
  serviceScope: "  Graduate recruitment and internship talent campaigns.  ",
  internalNote: "  Internal note  ",
};

describe("companyContractRegistrationSchema", () => {
  it("trims text and turns optional empty values into null", () => {
    expect(
      companyContractRegistrationSchema.parse({
        ...validContract,
        reference: "  ",
        endsOn: "",
        internalNote: " ",
      }),
    ).toEqual({
      reference: null,
      signedOn: "2026-11-10",
      startsOn: "2026-12-01",
      endsOn: null,
      serviceScope: "Graduate recruitment and internship talent campaigns.",
      internalNote: null,
    });
  });

  it("accepts the full signed-contract metadata within database limits", () => {
    expect(companyContractRegistrationSchema.parse(validContract)).toMatchObject({
      reference: "HR-2026-01",
      serviceScope: "Graduate recruitment and internship talent campaigns.",
      internalNote: "Internal note",
    });
  });

  it("rejects a missing or whitespace-only service scope", () => {
    expect(
      companyContractRegistrationSchema.safeParse({ ...validContract, serviceScope: "   " }).success,
    ).toBe(false);
  });

  it("rejects an end date earlier than the start date", () => {
    const result = companyContractRegistrationSchema.safeParse({
      ...validContract,
      startsOn: "2027-01-01",
      endsOn: "2026-12-31",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/end date/i);
  });

  it("rejects invalid calendar dates", () => {
    expect(
      companyContractRegistrationSchema.safeParse({ ...validContract, signedOn: "2026-02-30" }).success,
    ).toBe(false);
  });

  it("enforces the reference, scope and note limits", () => {
    expect(companyContractRegistrationSchema.safeParse({ ...validContract, reference: "x".repeat(121) }).success).toBe(false);
    expect(companyContractRegistrationSchema.safeParse({ ...validContract, serviceScope: "x".repeat(5001) }).success).toBe(false);
    expect(companyContractRegistrationSchema.safeParse({ ...validContract, internalNote: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("getCompanyContractStatus", () => {
  const today = "2026-11-14";

  it("marks a future contract as scheduled", () => {
    expect(
      getCompanyContractStatus(
        { startsOn: "2026-12-01", endsOn: "2027-11-30", terminatedAt: null },
        today,
      ),
    ).toBe("scheduled");
  });

  it("marks a contract active through its final day", () => {
    expect(
      getCompanyContractStatus(
        { startsOn: "2026-01-01", endsOn: today, terminatedAt: null },
        today,
      ),
    ).toBe("active");
  });

  it("marks a contract expired after its end date", () => {
    expect(
      getCompanyContractStatus(
        { startsOn: "2025-01-01", endsOn: "2026-11-13", terminatedAt: null },
        today,
      ),
    ).toBe("expired");
  });

  it("gives early termination precedence over date-derived status", () => {
    expect(
      getCompanyContractStatus(
        { startsOn: "2026-01-01", endsOn: null, terminatedAt: "2026-11-14T10:00:00Z" },
        today,
      ),
    ).toBe("terminated");
  });
});

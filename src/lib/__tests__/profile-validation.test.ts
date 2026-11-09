import { describe, expect, it } from "vitest";
import { splitPhone, toE164 } from "../countries";
import {
  educationSchema,
  experienceSchema,
  interestsSchema,
  linksSchema,
  personalDraftSchema,
  personalRequiredSchema,
} from "../validation/profile";

describe("phone numbers", () => {
  it("accepts Mozambican mobiles in common formats", () => {
    expect(toE164("+258", "84 123 4567")).toBe("+258841234567");
    expect(toE164("+258", "841234567")).toBe("+258841234567");
    expect(toE164("+258", "087-123-4567")).toBe("+258871234567");
  });

  it("rejects invalid Mozambican numbers", () => {
    expect(toE164("+258", "21 123 456")).toBeNull(); // landline length
    expect(toE164("+258", "891234567")).toBeNull(); // 89 is not a mobile prefix
    expect(toE164("+258", "84123")).toBeNull();
  });

  it("handles other countries and round-trips", () => {
    expect(toE164("+27", "82 555 1234")).toBe("+27825551234");
    expect(splitPhone("+258841234567")).toEqual({ dial: "+258", national: "841234567" });
    expect(splitPhone(null)).toEqual({ dial: "+258", national: "" });
  });
});

describe("personal information", () => {
  const complete = {
    firstName: "Amina", middleName: "", surname: "Macuácua", dateOfBirth: "2003-05-14", gender: "",
    nationality: "MZ", country: "MZ", provinceId: "1", city: "Maputo", phoneDial: "+258", phoneNumber: "84 123 4567",
    linkedinUrl: "linkedin.com/in/amina",
  };

  it("autosave accepts partial forms", () => {
    expect(personalDraftSchema.safeParse({ firstName: "Amina" }).success).toBe(true);
  });

  it("autosave still rejects badly formatted values", () => {
    const r = personalDraftSchema.safeParse({ phoneNumber: "123" });
    expect(r.success).toBe(false);
  });

  it("continue requires the mandatory fields", () => {
    const r = personalRequiredSchema.safeParse({ firstName: "Amina" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["surname", "dateOfBirth", "nationality", "provinceId", "city", "phoneNumber"]));
    }
  });

  it("normalises phone and LinkedIn on a complete form", () => {
    const r = personalRequiredSchema.safeParse(complete);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("+258841234567");
      expect(r.data.linkedinUrl).toBe("https://linkedin.com/in/amina");
    }
  });

  it("province is only required in Mozambique", () => {
    const r = personalRequiredSchema.safeParse({ ...complete, country: "ZA", provinceId: "", phoneDial: "+27", phoneNumber: "825551234" });
    expect(r.success).toBe(true);
  });

  it("rejects unrealistic dates of birth", () => {
    expect(personalDraftSchema.safeParse({ dateOfBirth: "2020-01-01" }).success).toBe(false);
  });
});

describe("education", () => {
  const base = {
    institutionId: "11111111-1111-4111-8111-111111111111", institutionType: "university", qualificationTypeId: "6",
    fieldOfStudyId: "1", academicStatus: "enrolled", startYear: "2023", endYear: "2027", gradeScale: "20",
  };

  it("accepts a current student", () => {
    expect(educationSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an institution typed by the student", () => {
    expect(educationSchema.safeParse({ ...base, institutionId: "", institutionNameOther: "Escola Técnica de Chimoio", institutionType: "tvet" }).success).toBe(true);
  });

  it("requires an institution and a field of study", () => {
    expect(educationSchema.safeParse({ ...base, institutionId: "" }).success).toBe(false);
    expect(educationSchema.safeParse({ ...base, fieldOfStudyId: "" }).success).toBe(false);
  });

  it("checks years and graduation", () => {
    expect(educationSchema.safeParse({ ...base, endYear: "2020" }).success).toBe(false);
    expect(educationSchema.safeParse({ ...base, academicStatus: "graduated", endYear: "" }).success).toBe(false);
    expect(educationSchema.safeParse({ ...base, academicStatus: "graduated", endYear: "2099" }).success).toBe(false);
  });

  it("checks the grade against its scale", () => {
    expect(educationSchema.safeParse({ ...base, grade: "14.5" }).success).toBe(true);
    expect(educationSchema.safeParse({ ...base, grade: "21" }).success).toBe(false);
  });
});

describe("experience", () => {
  const base = { organisation: "Banco Exemplo", roleTitle: "Finance intern", experienceType: "internship", startMonth: "2024-02", endMonth: "2024-05", isCurrent: "" };

  it("accepts a finished internship and stores first-of-month dates", () => {
    const r = experienceSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.startMonth).toBe("2024-02-01");
  });

  it("requires an end date unless current", () => {
    expect(experienceSchema.safeParse({ ...base, endMonth: "" }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...base, endMonth: "", isCurrent: "on" }).success).toBe(true);
  });

  it("rejects an end before the start", () => {
    expect(experienceSchema.safeParse({ ...base, endMonth: "2023-12" }).success).toBe(false);
  });
});

describe("interests and links", () => {
  const base = {
    industryIds: [1], jobFunctionIds: [2], provinceIds: [1], preferredRoles: ["Audit trainee"], careerInterests: null,
    workArrangements: ["hybrid"], availability: "immediately", availableFrom: null, internshipDuration: null,
    hasWorkExperience: null, willingToRelocate: true,
  };

  it("accepts valid interests", () => {
    expect(interestsSchema.safeParse(base).success).toBe(true);
  });

  it("requires a date when starting on a specific date", () => {
    expect(interestsSchema.safeParse({ ...base, availability: "specific_date" }).success).toBe(false);
  });

  it("limits preferred roles to five", () => {
    expect(interestsSchema.safeParse({ ...base, preferredRoles: ["a1", "b2", "c3", "d4", "e5", "f6"] }).success).toBe(false);
  });

  it("validates portfolio links", () => {
    expect(linksSchema.safeParse({ githubUrl: "github.com/amina" }).success).toBe(true);
    expect(linksSchema.safeParse({ githubUrl: "gitlab.com/amina" }).success).toBe(false);
    expect(linksSchema.safeParse({ linkedinUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

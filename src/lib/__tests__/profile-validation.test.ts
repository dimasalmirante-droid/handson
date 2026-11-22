import { describe, expect, it } from "vitest";
import { splitPhone, toE164 } from "../countries";
import {
  ageOn,
  educationSchema,
  experienceSchema,
  interestsSchema,
  languageSchema,
  linksSchema,
  publicProfileSchema,
  suggestSlug,
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
    linkedinUrl: "linkedin.com/in/amina", headline: "Finalista de Contabilidade à procura de estágio",
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
      expect(paths).toEqual(expect.arrayContaining(["surname", "dateOfBirth", "nationality", "provinceId", "districtId", "phoneNumber", "headline"]));
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

  it("in Mozambique, a district or a typed city satisfies the location", () => {
    expect(personalRequiredSchema.safeParse({ ...complete, city: "", districtId: "12" }).success).toBe(true);
    expect(personalRequiredSchema.safeParse({ ...complete, city: "Maputo", districtId: "" }).success).toBe(true);
    const r = personalRequiredSchema.safeParse({ ...complete, city: "", districtId: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("districtId");
  });

  it("outside Mozambique, the city is required", () => {
    const r = personalRequiredSchema.safeParse({ ...complete, country: "ZA", provinceId: "", city: "", phoneDial: "+27", phoneNumber: "825551234" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("city");
  });

  it("limits headline and summary length", () => {
    expect(personalDraftSchema.safeParse({ headline: "x".repeat(121) }).success).toBe(false);
    expect(personalDraftSchema.safeParse({ summary: "x".repeat(601) }).success).toBe(false);
    expect(personalDraftSchema.safeParse({ headline: "x".repeat(120), summary: "x".repeat(600) }).success).toBe(true);
  });

  it("rejects unrealistic dates of birth", () => {
    expect(personalDraftSchema.safeParse({ dateOfBirth: "2020-01-01" }).success).toBe(false);
    expect(personalDraftSchema.safeParse({ dateOfBirth: "1900-01-01" }).success).toBe(false);
  });

  it("requires students to be 18 or older, counted to the day", () => {
    const today = new Date(2026, 10, 22);
    expect(ageOn("2008-11-22", today)).toBe(18);
    expect(ageOn("2008-11-23", today)).toBe(17);
    expect(ageOn("2000-02-29", new Date(2018, 1, 28))).toBe(17);
    expect(ageOn("2000-02-29", new Date(2018, 2, 1))).toBe(18);

    const now = new Date();
    const iso = (years: number, dayShift = 0) => {
      const d = new Date(now.getFullYear() - years, now.getMonth(), now.getDate() + dayShift);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const minor = personalDraftSchema.safeParse({ dateOfBirth: iso(18, 1) });
    expect(minor.success).toBe(false);
    if (!minor.success) expect(minor.error.issues[0].message).toBe("You must be 18 or older to use Handson.");
    expect(personalDraftSchema.safeParse({ dateOfBirth: iso(18) }).success).toBe(true);
  });
});

describe("languages", () => {
  it("accepts a language with a known level only", () => {
    expect(languageSchema.safeParse({ languageId: "1", level: "native" }).success).toBe(true);
    expect(languageSchema.safeParse({ languageId: "1", level: "expert" }).success).toBe(false);
    expect(languageSchema.safeParse({ languageId: "", level: "basic" }).success).toBe(false);
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

describe("public profile", () => {
  it("suggests an address from the name", () => {
    expect(suggestSlug("Amina", "Macuácua")).toBe("amina-macuacua");
    expect(suggestSlug("João  Paulo", null, "N'Dlovu")).toBe("joao-paulo-n-dlovu");
    expect(suggestSlug(null, undefined)).toBe("");
    expect(suggestSlug("a".repeat(30), "b".repeat(30))).toHaveLength(40);
  });

  it("validates the address and sections", () => {
    const ok = publicProfileSchema.safeParse({ enabled: true, slug: " Amina-Macuacua ", sections: ["headline", "skills"] });
    expect(ok.success && ok.data.slug).toBe("amina-macuacua");
    expect(publicProfileSchema.safeParse({ enabled: true, slug: "", sections: [] }).success).toBe(false);
    expect(publicProfileSchema.safeParse({ enabled: false, slug: "", sections: [] }).success).toBe(true);
    expect(publicProfileSchema.safeParse({ enabled: true, slug: "admin", sections: [] }).success).toBe(false);
    expect(publicProfileSchema.safeParse({ enabled: true, slug: "a--b", sections: [] }).success).toBe(false);
    expect(publicProfileSchema.safeParse({ enabled: true, slug: "amina", sections: ["phone"] }).success).toBe(false);
  });
});

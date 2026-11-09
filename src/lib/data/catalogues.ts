import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Option = { id: number; name: string };
export type Province = Option & { code: string };
export type Institution = { id: string; name: string; shortName: string | null; type: string; province: string | null };
export type QualificationType = Option & { code: string; institutionTypes: string[] };
export type FieldOfStudy = Option & { code: string; area: string };
export type SkillCategory = Option & { code: string };
export type Skill = Option & { categoryId: number; aliases: string[] };

export type Catalogues = {
  provinces: Province[];
  institutions: Institution[];
  qualificationTypes: QualificationType[];
  fieldsOfStudy: FieldOfStudy[];
  skillCategories: SkillCategory[];
  skills: Skill[];
  industries: Option[];
  jobFunctions: Option[];
};

/**
 * All reference catalogues in the requested language. Loaded once per
 * request; the lists are small (a few hundred rows in total).
 */
export const getCatalogues = cache(async (locale: "en" | "pt" = "en"): Promise<Catalogues> => {
  const supabase = await createClient();
  const name = locale === "pt" ? "name_pt" : "name_en";

  const [provinces, institutions, qualifications, fields, categories, skills, industries, functions] = await Promise.all([
    supabase.from("provinces").select("id, code, name_en, name_pt").eq("country_code", "MZ").order("sort_order"),
    supabase.from("institutions").select("id, name, short_name, type, provinces(name_en, name_pt)").eq("is_active", true).order("name"),
    supabase.from("qualification_types").select("id, code, name_en, name_pt, institution_types").order("sort_order"),
    supabase.from("fields_of_study").select("id, code, area, name_en, name_pt").order("sort_order"),
    supabase.from("skill_categories").select("id, code, name_en, name_pt").order("sort_order"),
    supabase.from("skill_catalogue").select("id, category_id, name_en, name_pt, aliases").eq("is_active", true).order(name),
    supabase.from("industries").select("id, name_en, name_pt").order("sort_order"),
    supabase.from("job_functions").select("id, name_en, name_pt").order("sort_order"),
  ]);

  const firstError = [provinces, institutions, qualifications, fields, categories, skills, industries, functions].find((r) => r.error);
  if (firstError?.error) throw new Error(`Could not load reference data: ${firstError.error.message}`);

  type Named = { name_en: string; name_pt: string };
  const n = (r: Named) => (locale === "pt" ? r.name_pt : r.name_en);

  return {
    provinces: (provinces.data ?? []).map((r) => ({ id: r.id, code: r.code, name: n(r) })),
    institutions: (institutions.data ?? []).map((r) => {
      const p = r.provinces as unknown as Named | null;
      return { id: r.id, name: r.name, shortName: r.short_name, type: r.type, province: p ? n(p) : null };
    }),
    qualificationTypes: (qualifications.data ?? []).map((r) => ({
      id: r.id, code: r.code, name: n(r), institutionTypes: r.institution_types as string[],
    })),
    fieldsOfStudy: (fields.data ?? []).map((r) => ({ id: r.id, code: r.code, area: r.area, name: n(r) })),
    skillCategories: (categories.data ?? []).map((r) => ({ id: r.id, code: r.code, name: n(r) })),
    skills: (skills.data ?? []).map((r) => ({ id: r.id, categoryId: r.category_id, name: n(r), aliases: r.aliases ?? [] })),
    industries: (industries.data ?? []).map((r) => ({ id: r.id, name: n(r) })),
    jobFunctions: (functions.data ?? []).map((r) => ({ id: r.id, name: n(r) })),
  };
});

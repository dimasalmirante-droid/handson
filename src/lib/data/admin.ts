import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StudentFilters = {
  q?: string;
  institution?: string;
  qualification?: number;
  field?: number;
  province?: number;
  skill?: number;
  year?: number;
  verification?: "unverified" | "pending" | "verified" | "rejected";
  status?: "active" | "suspended";
  visible?: boolean;
  min?: number;
  max?: number;
  sort?: "newest" | "oldest" | "name" | "completion";
  page: number;
};

export type StudentRow = {
  id: string;
  first_name: string | null;
  surname: string | null;
  email: string;
  phone: string | null;
  province: string | null;
  city: string | null;
  institution: string | null;
  qualification: string | null;
  field_of_study: string | null;
  graduation_year: number | null;
  completion: number;
  verification_status: string;
  account_status: string;
  employer_visibility: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  total_count: number;
};

export const PAGE_SIZE = 25;

const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const oneOf = <T extends string>(v: unknown, values: readonly T[]) =>
  typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : undefined;

/** Parse and sanitise filters from the URL. Unknown or malformed values are ignored. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): StudentFilters {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]);
  const q = get("q")?.trim().slice(0, 100);
  const institution = get("institution");
  return {
    q: q || undefined,
    institution: institution && /^[0-9a-f-]{36}$/.test(institution) ? institution : undefined,
    qualification: int(get("qualification"), 1, 32767),
    field: int(get("field"), 1, 32767),
    province: int(get("province"), 1, 32767),
    skill: int(get("skill"), 1),
    year: int(get("year"), 1960, 2100),
    verification: oneOf(get("verification"), ["unverified", "pending", "verified", "rejected"] as const),
    status: oneOf(get("status"), ["active", "suspended"] as const),
    visible: get("visible") === "yes" ? true : get("visible") === "no" ? false : undefined,
    min: int(get("min"), 0, 100),
    max: int(get("max"), 0, 100),
    sort: oneOf(get("sort"), ["newest", "oldest", "name", "completion"] as const),
    page: int(get("page"), 1, 100000) ?? 1,
  };
}

/** Rebuild a query string from filters (for pagination and export links). */
export function filtersToQuery(f: Partial<StudentFilters>, overrides: Partial<StudentFilters> = {}): string {
  const merged = { ...f, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "page" && v === 1) continue;
    if (k === "visible") params.set(k, v ? "yes" : "no");
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Runs the admin search function; the database verifies the caller is an administrator. */
export async function searchStudents(f: StudentFilters, limit = PAGE_SIZE, offset?: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search_students", {
    p_query: f.q ?? null,
    p_institution: f.institution ?? null,
    p_qualification: f.qualification ?? null,
    p_field: f.field ?? null,
    p_province: f.province ?? null,
    p_skill: f.skill ?? null,
    p_grad_year: f.year ?? null,
    p_verification: f.verification ?? null,
    p_account_status: f.status ?? null,
    p_visible: f.visible ?? null,
    p_min_completion: f.min ?? null,
    p_max_completion: f.max ?? null,
    p_sort: f.sort ?? "newest",
    p_limit: limit,
    p_offset: offset ?? (f.page - 1) * limit,
  });
  if (error) throw new Error(`Student search failed: ${error.message}`);
  const rows = (data ?? []) as StudentRow[];
  return { rows, total: rows.length ? Number(rows[0].total_count) : 0 };
}

export type AdminStats = {
  total: number;
  onboarded: number;
  verified: number;
  pending: number;
  visible: number;
  suspended: number;
  new_7_days: number;
  new_30_days: number;
  documents_to_review: number;
  by_province: { province: string; count: number }[];
  by_institution_type: { type: string; count: number }[];
};

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) throw new Error(`Statistics failed: ${error.message}`);
  return data as AdminStats;
}

/** Record that an administrator viewed a student's profile. */
export async function logProfileView(profileId: string) {
  const supabase = await createClient();
  await supabase.rpc("log_admin_action", { p_action: "student.viewed", p_target_table: "profiles", p_target_id: profileId });
}

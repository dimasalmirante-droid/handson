import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { parseFilters, searchStudents } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_ROWS = 5000;

/**
 * CSV export of the students matching the current filters (administrators
 * and above). Includes the fields needed for programme management; excludes
 * date of birth, gender, documents and consent details. Every export is
 * recorded in the audit log.
 */
export async function GET(request: NextRequest) {
  await requireAdmin("admin");
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { rows, total } = await searchStudents({ ...filters, page: 1 }, MAX_ROWS, 0);

  const supabase = await createClient();
  const { page: _page, ...appliedFilters } = filters;
  void _page;
  await supabase.rpc("log_admin_action", {
    p_action: "students.exported",
    p_target_table: "profiles",
    p_target_id: null,
    p_metadata: { rows: rows.length, total, filters: appliedFilters },
  });

  const csv = toCsv(
    ["First name", "Surname", "Email", "Phone", "Province", "City", "Institution", "Qualification", "Field of study", "Graduation year",
     "Completion %", "Verification", "Visible to employers", "Account", "Onboarding completed", "Registered"],
    rows.map((r) => [
      r.first_name, r.surname, r.email, r.phone, r.province, r.city, r.institution, r.qualification, r.field_of_study, r.graduation_year,
      r.completion, r.verification_status, r.employer_visibility ? "Yes" : "No", r.account_status,
      r.onboarding_completed_at ? r.onboarding_completed_at.slice(0, 10) : "", r.created_at.slice(0, 10),
    ]),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="handson-students-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      ...(total > MAX_ROWS ? { "X-Handson-Truncated": `${MAX_ROWS} of ${total}` } : {}),
    },
  });
}

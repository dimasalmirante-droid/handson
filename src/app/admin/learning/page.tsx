import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Learning" };

type Row = {
  course_id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived";
  audience: "all_students" | "restricted";
  price_mzn: number;
  lessons: number;
  started: number;
  completed: number;
  with_access: number;
};

const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : "–");

export default async function AdminLearningPage() {
  await requireAdmin("reviewer");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_learning_overview");
  if (error) console.error("admin_learning_overview failed", error.code, error.message);
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader title="Learning" lead="How students are getting on with each course. Figures are totals; no student is named." />
      {rows.length === 0 ? (
        <EmptyState title="No courses yet" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-surface-raised">
          <table className="w-full min-w-[760px] text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-sm text-ink-muted">
                <th scope="col" className="px-4 py-3 font-medium">Course</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Lessons</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">With access</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Started</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Completed</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Completion rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.course_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/learning/${r.course_id}`} className="font-semibold text-indigo hover:underline">{r.title}</Link>
                    <p className="text-sm text-ink-muted">
                      {r.audience === "restricted" ? "Restricted (code or grant)" : "All students"}
                      {r.price_mzn > 0 ? ` · ${r.price_mzn.toLocaleString("en")} MZN` : " · Free"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.status === "published" ? "success" : r.status === "draft" ? "warning" : "neutral"}>
                      {r.status[0].toUpperCase() + r.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.lessons}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.audience === "restricted" || r.price_mzn > 0 ? r.with_access : "All"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.started}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.completed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pct(r.completed, r.started)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

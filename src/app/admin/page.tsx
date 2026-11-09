import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminStats } from "@/lib/data/admin";
import { INSTITUTION_TYPE_LABELS } from "@/lib/onboarding/labels";

function Stat({ label, value, href, note }: { label: string; value: number; href?: string; note?: string }) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-[34px] font-bold leading-none tabular-nums">{value.toLocaleString("en-GB")}</p>
      {note && <p className="mt-2 text-sm text-ink-muted">{note}</p>}
    </>
  );
  const cls = "block rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5";
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-indigo`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export default async function AdminOverview() {
  await requireAdmin("reviewer");
  const s = await getAdminStats();
  const maxProvince = Math.max(1, ...s.by_province.map((p) => p.count));

  return (
    <>
      <PageHeader
        title="Overview"
        lead="Student registrations and profile status, from live data."
        action={<ButtonLink href="/admin/students">Search students</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Registered students" value={s.total} href="/admin/students" note={`${s.new_7_days} in the last 7 days`} />
        <Stat label="Completed onboarding" value={s.onboarded} note={s.total ? `${Math.round((s.onboarded / s.total) * 100)}% of students` : undefined} />
        <Stat label="Verified profiles" value={s.verified} href="/admin/students?verification=verified" />
        <Stat label="Awaiting review" value={s.pending} href="/admin/students?verification=pending" />
        <Stat label="Visible to employers" value={s.visible} href="/admin/students?visible=yes" />
        <Stat label="Documents not yet verified" value={s.documents_to_review} />
        <Stat label="New in 30 days" value={s.new_30_days} />
        <Stat label="Suspended accounts" value={s.suspended} href="/admin/students?status=suspended" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
          <h2 className="mb-4 text-lg">Students by province</h2>
          {s.by_province.length === 0 ? (
            <p className="text-ink-muted">No students yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {s.by_province.map((p) => (
                <li key={p.province}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{p.province}</span>
                    <span className="tabular-nums text-ink-muted">{p.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-indigo-soft">
                    <div className="h-full rounded-full bg-indigo" style={{ width: `${(p.count / maxProvince) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
          <h2 className="mb-4 text-lg">Students by education pathway</h2>
          {s.by_institution_type.length === 0 ? (
            <p className="text-ink-muted">No education records yet.</p>
          ) : (
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-sm text-ink-muted">
                  <th className="py-2 font-medium">Pathway</th>
                  <th className="py-2 text-right font-medium">Students</th>
                </tr>
              </thead>
              <tbody>
                {s.by_institution_type.map((t) => (
                  <tr key={t.type} className="border-b border-line last:border-0">
                    <td className="py-2.5">{INSTITUTION_TYPE_LABELS[t.type] ?? t.type}</td>
                    <td className="py-2.5 text-right tabular-nums">{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

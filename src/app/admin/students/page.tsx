import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { requireAdmin, roleAtLeast } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { PAGE_SIZE, filtersToQuery, parseFilters, searchStudents } from "@/lib/data/admin";
import { getCatalogues } from "@/lib/data/catalogues";

export const metadata: Metadata = { title: "Students" };

const VERIFICATION = {
  unverified: { tone: "neutral", label: "Not verified" },
  pending: { tone: "indigo", label: "Pending" },
  verified: { tone: "success", label: "Verified" },
  rejected: { tone: "danger", label: "Rejected" },
} as const;

function FilterSelect({ name, label, value, children }: { name: string; label: string; value?: string | number; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <Select name={name} defaultValue={value ?? ""} className="h-10 text-[15px] font-normal">
        <option value="">Any</option>
        {children}
      </Select>
    </label>
  );
}

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const { role } = await requireAdmin("reviewer");
  const sp = await searchParams;
  const f = parseFilters(sp);
  const [{ rows, total }, catalogues] = await Promise.all([searchStudents(f), getCatalogues()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters = Object.entries(f).filter(([k, v]) => k !== "page" && k !== "sort" && v !== undefined).length;
  const canExport = roleAtLeast(role, "admin");
  const thisYear = new Date().getFullYear();

  return (
    <>
      <PageHeader
        title="Students"
        lead={`${total.toLocaleString("en-GB")} ${total === 1 ? "student matches" : "students match"} your filters.`}
        action={
          canExport && total > 0 ? (
            <a href={`/admin/students/export${filtersToQuery(f, { page: 1 })}`} className={buttonClasses({ variant: "secondary" })}>
              Export CSV
            </a>
          ) : undefined
        }
      />

      <form method="get" className="mb-6 rounded-[var(--radius-lg)] border border-line bg-surface-raised p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="q">Search</label>
          <Input id="q" name="q" defaultValue={f.q} placeholder="Search by name, email or phone" className="h-11" />
          <Button type="submit" className="h-11 shrink-0">Search</Button>
        </div>
        <details className="mt-3" open={activeFilters > (f.q ? 1 : 0)}>
          <summary className="cursor-pointer text-sm font-semibold text-indigo">
            Filters{activeFilters > (f.q ? 1 : 0) ? ` (${activeFilters - (f.q ? 1 : 0)} active)` : ""}
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect name="institution" label="Institution" value={f.institution}>
              {catalogues.institutions.map((i) => <option key={i.id} value={i.id}>{i.shortName ? `${i.shortName} – ${i.name}` : i.name}</option>)}
            </FilterSelect>
            <FilterSelect name="qualification" label="Qualification" value={f.qualification}>
              {catalogues.qualificationTypes.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </FilterSelect>
            <FilterSelect name="field" label="Field of study" value={f.field}>
              {catalogues.fieldsOfStudy.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </FilterSelect>
            <FilterSelect name="province" label="Province" value={f.province}>
              {catalogues.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FilterSelect>
            <FilterSelect name="skill" label="Skill" value={f.skill}>
              {catalogues.skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FilterSelect>
            <FilterSelect name="year" label="Graduation year" value={f.year}>
              {Array.from({ length: 15 }, (_, i) => thisYear + 6 - i).map((y) => <option key={y} value={y}>{y}</option>)}
            </FilterSelect>
            <FilterSelect name="verification" label="Verification" value={f.verification}>
              {Object.entries(VERIFICATION).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
            </FilterSelect>
            <FilterSelect name="visible" label="Employer visibility" value={f.visible === undefined ? undefined : f.visible ? "yes" : "no"}>
              <option value="yes">Visible</option>
              <option value="no">Private</option>
            </FilterSelect>
            <FilterSelect name="min" label="Completion at least" value={f.min}>
              {[25, 50, 75, 90, 100].map((n) => <option key={n} value={n}>{n}%</option>)}
            </FilterSelect>
            <FilterSelect name="max" label="Completion at most" value={f.max}>
              {[25, 50, 75, 90].map((n) => <option key={n} value={n}>{n}%</option>)}
            </FilterSelect>
            <FilterSelect name="status" label="Account" value={f.status}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </FilterSelect>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Sort by
              <Select name="sort" defaultValue={f.sort ?? "newest"} className="h-10 text-[15px] font-normal">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Surname A–Z</option>
                <option value="completion">Highest completion</option>
              </Select>
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="submit" size="sm">Apply filters</Button>
            <Link href="/admin/students" className={buttonClasses({ variant: "ghost", size: "sm" })}>Clear all</Link>
          </div>
        </details>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No students found" action={activeFilters ? <ButtonLink href="/admin/students" variant="secondary">Clear filters</ButtonLink> : undefined}>
          {activeFilters ? "Try removing some filters." : "Students will appear here as they register."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-surface-raised">
          <table className="w-full min-w-[860px] text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-sm text-ink-muted">
                <th scope="col" className="px-4 py-3 font-medium">Student</th>
                <th scope="col" className="px-4 py-3 font-medium">Education</th>
                <th scope="col" className="px-4 py-3 font-medium">Province</th>
                <th scope="col" className="px-4 py-3 font-medium">Completion</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = VERIFICATION[r.verification_status as keyof typeof VERIFICATION] ?? VERIFICATION.unverified;
                const name = [r.first_name, r.surname].filter(Boolean).join(" ") || "Name not added";
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link href={`/admin/students/${r.id}`} className="font-semibold text-indigo hover:underline">{name}</Link>
                      <p className="text-sm text-ink-muted">{r.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{r.qualification ?? <span className="text-ink-muted">—</span>}</p>
                      <p className="text-sm text-ink-muted">
                        {[r.institution, r.field_of_study, r.graduation_year].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-4 py-3">{r.province ?? <span className="text-ink-muted">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-indigo-soft" aria-hidden>
                          <div className="h-full rounded-full bg-indigo" style={{ width: `${r.completion}%` }} />
                        </div>
                        <span className="tabular-nums">{r.completion}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={v.tone}>{v.label}</Badge>
                        {r.account_status === "suspended" && <Badge tone="danger">Suspended</Badge>}
                        {r.employer_visibility && <Badge tone="lime">Visible</Badge>}
                        {!r.onboarding_completed_at && <Badge tone="warning">Onboarding</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-muted">
                      {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-muted">
            Page {f.page} of {pages}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={f.page <= 1}
              href={`/admin/students${filtersToQuery(f, { page: f.page - 1 })}`}
              className={cn(buttonClasses({ variant: "secondary", size: "sm" }), f.page <= 1 && "pointer-events-none opacity-40")}
            >
              ← Previous
            </Link>
            <Link
              aria-disabled={f.page >= pages}
              href={`/admin/students${filtersToQuery(f, { page: f.page + 1 })}`}
              className={cn(buttonClasses({ variant: "secondary", size: "sm" }), f.page >= pages && "pointer-events-none opacity-40")}
            >
              Next →
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}

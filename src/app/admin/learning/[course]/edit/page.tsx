import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import {
  AddLessonForm,
  AddModuleForm,
  CourseDangerZone,
  CourseForm,
  DisableVoucherButton,
  GrantForm,
  LessonRowActions,
  ModuleHeader,
  RevokeAccessButton,
  VoucherForm,
  type CourseValues,
} from "@/components/admin/course-editor";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { publishProblems, type EditorLessonType } from "@/lib/learning/editor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit course" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTICES: Record<string, string> = {
  created: "Course created as a draft. Add modules and lessons, then publish it.",
  "lesson-deleted": "Lesson deleted.",
};

const TYPE_LABEL: Record<string, string> = { text: "Reading", video: "Video", quiz: "Quiz", link: "Link", file: "File" };

type Lesson = { id: string; position: number; title: string; lesson_type: EditorLessonType; is_preview: boolean; quiz_questions: { count: number }[] };
type Module = { id: string; position: number; title: string; objective: string | null; course_lessons: Lesson[] };

/** True once a code's end date has passed (disabled codes are set to expire immediately). */
const isPast = (v: string | null) => v !== null && new Date(v).getTime() <= Date.now();

const date = (v: string) => new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Maputo" });

export default async function EditCoursePage({ params, searchParams }: PageProps<"/admin/learning/[course]/edit">) {
  await requireAdmin("admin");
  const { course: id } = await params;
  const { notice } = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();

  const [{ data: course }, { data: categories }, { data: modules }, { data: vouchers }, { data: grants }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, slug, title, summary, category_id, status, audience, sequential, pass_mark, badge_name, price_mzn, sort_order, version")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("course_categories").select("id, name").order("sort_order"),
    supabase
      .from("course_modules")
      .select("id, position, title, objective, course_lessons(id, position, title, lesson_type, is_preview, quiz_questions(count))")
      .eq("course_id", id)
      .order("position"),
    supabase.from("course_vouchers").select("id, code, max_uses, used_count, expires_at, sponsor_name").eq("course_id", id).order("created_at", { ascending: false }),
    supabase
      .from("course_access")
      .select("id, user_id, source, amount_mzn, sponsor_name, note, granted_at")
      .eq("course_id", id)
      .is("revoked_at", null)
      .neq("source", "voucher")
      .order("granted_at", { ascending: false })
      .limit(100),
  ]);
  if (!course) notFound();

  const mods = ((modules ?? []) as Module[]).map((m) => ({ ...m, course_lessons: [...m.course_lessons].sort((a, b) => a.position - b.position) }));
  const problems = publishProblems({
    modules: mods.map((m) => ({
      title: m.title,
      lessons: m.course_lessons.map((l) => ({ title: l.title, type: l.lesson_type, questions: l.quiz_questions[0]?.count ?? 0 })),
    })),
  });

  const grantRows = grants ?? [];
  const { data: students } = grantRows.length
    ? await supabase.from("profiles").select("id, email").in("id", grantRows.map((g) => g.user_id as string))
    : { data: [] };
  const emailOf = new Map((students ?? []).map((s) => [s.id as string, s.email as string]));

  const initial: CourseValues = {
    title: course.title,
    slug: course.slug,
    summary: course.summary ?? "",
    categoryId: course.category_id ? String(course.category_id) : "",
    status: course.status,
    audience: course.audience,
    sequential: course.sequential,
    passMark: course.pass_mark,
    badgeName: course.badge_name ?? "",
    priceMzn: course.price_mzn,
    sortOrder: course.sort_order,
  };
  const restricted = course.audience === "restricted" || course.price_mzn > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/admin/learning" className="text-indigo hover:underline">← All courses</Link>
        <Link href={`/admin/learning/${id}`} className="text-indigo hover:underline">Results</Link>
      </div>
      <PageHeader
        title={course.title}
        lead={`Version ${course.version} · ${mods.length} modules · ${mods.reduce((n, m) => n + m.course_lessons.length, 0)} lessons`}
        action={
          <Badge tone={course.status === "published" ? "success" : course.status === "draft" ? "warning" : "neutral"}>
            {course.status[0].toUpperCase() + course.status.slice(1)}
          </Badge>
        }
      />
      {typeof notice === "string" && NOTICES[notice] && <Alert tone="success">{NOTICES[notice]}</Alert>}
      {course.status !== "published" && problems.length > 0 && (
        <Alert tone="warning" title="Before publishing">
          <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Alert>
      )}

      <Panel title="Settings">
        <CourseForm courseId={id} categories={(categories ?? []) as { id: number; name: string }[]} initial={initial} />
      </Panel>

      <Panel title="Modules and lessons">
        <div className="flex flex-col gap-6">
          {mods.map((m, i) => (
            <section key={m.id} className="flex flex-col gap-3 border-b border-line pb-6">
              <ModuleHeader module={m} first={i === 0} last={i === mods.length - 1} />
              {m.course_lessons.length > 0 && (
                <ol className="flex flex-col divide-y divide-line rounded-[14px] border border-line">
                  {m.course_lessons.map((l, j) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm tabular-nums text-ink-muted">{m.position}.{l.position}</span>
                        <Link href={`/admin/learning/${id}/lessons/${l.id}`} className="font-semibold text-indigo hover:underline">{l.title}</Link>
                        <span className="text-sm text-ink-muted">
                          {TYPE_LABEL[l.lesson_type]}
                          {l.lesson_type === "quiz" ? ` · ${l.quiz_questions[0]?.count ?? 0} questions` : ""}
                          {l.is_preview ? " · free preview" : ""}
                        </span>
                      </div>
                      <LessonRowActions lessonId={l.id} first={j === 0} last={j === m.course_lessons.length - 1} />
                    </li>
                  ))}
                </ol>
              )}
              <AddLessonForm moduleId={m.id} />
            </section>
          ))}
          <AddModuleForm courseId={id} />
        </div>
      </Panel>

      <Panel title="Access">
        {!restricted && (
          <p className="mb-4 text-[15px] text-ink-muted">This course is free and open to all students. Codes and grants matter only for restricted or paid courses.</p>
        )}
        <h3 className="mb-3 text-[17px]">Access codes</h3>
        {(vouchers ?? []).length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-sm text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Code</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Used</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Valid until</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Sponsor</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(vouchers ?? []).map((v) => {
                  const expired = isPast(v.expires_at);
                  const full = v.max_uses !== null && v.used_count >= v.max_uses;
                  return (
                    <tr key={v.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4 font-mono">{v.code}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{v.used_count}{v.max_uses !== null ? ` of ${v.max_uses}` : ""}</td>
                      <td className="py-2.5 pr-4">
                        {expired ? <Badge>Disabled</Badge> : v.expires_at ? date(v.expires_at) : "No end date"}
                        {full && !expired && <Badge className="ml-2">All used</Badge>}
                      </td>
                      <td className="py-2.5 pr-4">{v.sponsor_name ?? "–"}</td>
                      <td className="py-2.5 text-right">{!expired && <DisableVoucherButton voucherId={v.id} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <VoucherForm courseId={id} />

        <h3 className="mb-3 mt-8 text-[17px]">Students given access</h3>
        <p className="mb-3 text-[15px] text-ink-muted">For a payment, a scholarship or a sponsor. Students who used a code are counted on the Results page.</p>
        {grantRows.length > 0 && (
          <ul className="mb-4 flex flex-col divide-y divide-line rounded-[14px] border border-line">
            {grantRows.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[15px]">
                <div>
                  <span className="font-semibold">{emailOf.get(g.user_id) ?? "Account removed"}</span>
                  <span className="ml-2 text-sm text-ink-muted">
                    {g.source === "purchase" ? `Paid ${g.amount_mzn.toLocaleString("en")} MZN` : g.source === "sponsor" ? `Sponsored${g.sponsor_name ? ` by ${g.sponsor_name}` : ""}` : "Handson grant"}
                    {` · ${date(g.granted_at)}`}
                    {g.note ? ` · ${g.note}` : ""}
                  </span>
                </div>
                <RevokeAccessButton accessId={g.id} courseId={id} />
              </li>
            ))}
          </ul>
        )}
        <GrantForm courseId={id} />
      </Panel>

      <Panel title="Version and deletion">
        <CourseDangerZone courseId={id} status={course.status} />
      </Panel>
    </div>
  );
}

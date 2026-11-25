import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { Alert } from "@/components/ui/feedback";
import { requireAdmin, roleAtLeast } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Course results" };

type QuizStats = {
  attempts: number;
  students: number;
  average_score: number | null;
  first_attempt_pass_rate: number | null;
  questions: { position: number; prompt: string; missed_pct: number | null }[];
};

type Results = {
  id: string;
  title: string;
  pass_mark: number;
  started: number;
  completed: number;
  lessons: { id: string; module: number; position: number; title: string; type: string; started: number; completed: number; quiz: QuizStats | null }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A question missed in at least this share of attempts is flagged for review. */
const FLAG_AT = 50;

function Bar({ value, tone = "indigo" }: { value: number; tone?: "indigo" | "danger" }) {
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-indigo-soft" aria-hidden>
      <div className={cn("h-full rounded-full", tone === "danger" ? "bg-danger" : "bg-indigo")} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export default async function CourseResultsPage({ params }: PageProps<"/admin/learning/[course]">) {
  const { role } = await requireAdmin("reviewer");
  const { course } = await params;
  if (!UUID.test(course)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_course_results", { p_course: course });
  if (error) console.error("admin_course_results failed", error.code, error.message);
  const r = data as Results | null;
  if (!r) notFound();

  const quizzes = r.lessons.filter((l) => l.quiz);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/admin/learning" className="text-indigo hover:underline">← All courses</Link>
        {roleAtLeast(role, "admin") && <Link href={`/admin/learning/${course}/edit`} className="text-indigo hover:underline">Edit course</Link>}
      </div>
      <PageHeader
        title={r.title}
        lead={`${r.started} started · ${r.completed} completed${r.started ? ` (${Math.round((100 * r.completed) / r.started)}%)` : ""} · pass mark ${r.pass_mark}%`}
      />

      <Panel title="Where students stop">
        <p className="mb-4 text-[15px] text-ink-muted">Students who opened each lesson and how many finished it, in course order.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-sm text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Lesson</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Started</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Completed</th>
                <th scope="col" className="py-2 font-medium">Of course starters</th>
              </tr>
            </thead>
            <tbody>
              {r.lessons.map((l) => {
                const share = r.started ? Math.round((100 * l.completed) / r.started) : 0;
                return (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="text-ink-muted">{l.module}.{l.position}</span> {l.title}
                      <span className="ml-2 text-sm text-ink-muted">({l.type})</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{l.started}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{l.completed}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-3">
                        <Bar value={share} />
                        <span className="text-sm tabular-nums text-ink-muted">{r.started ? `${share}%` : "–"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {quizzes.map((l) => {
        const q = l.quiz!;
        const flagged = q.questions.filter((x) => (x.missed_pct ?? 0) >= FLAG_AT);
        return (
          <Panel key={l.id} title={`Quiz: ${l.title}`}>
            {q.attempts === 0 ? (
              <p className="text-[15px] text-ink-muted">No attempts yet.</p>
            ) : (
              <>
                <dl className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ["Students", String(q.students)],
                    ["Attempts", String(q.attempts)],
                    ["Average score", q.average_score === null ? "–" : `${q.average_score}%`],
                    ["Passed first time", q.first_attempt_pass_rate === null ? "–" : `${q.first_attempt_pass_rate}%`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-sm text-ink-muted">{k}</dt>
                      <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                {flagged.length > 0 && (
                  <Alert tone="warning" className="mb-4">
                    {flagged.length === 1 ? "1 question is" : `${flagged.length} questions are`} missed in {FLAG_AT}% or more of attempts. Check whether the question is unclear or the lesson does not teach it.
                  </Alert>
                )}
                <p className="mb-2 text-sm font-semibold text-ink-muted">Missed in % of attempts, hardest first</p>
                <ol className="divide-y divide-line">
                  {[...q.questions]
                    .sort((a, b) => (b.missed_pct ?? 0) - (a.missed_pct ?? 0))
                    .map((x) => (
                      <li key={x.position} className="flex items-start justify-between gap-4 py-2.5">
                        <span className="text-[15px]">
                          <span className="text-ink-muted">Q{x.position}.</span> {x.prompt}
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <Bar value={x.missed_pct ?? 0} tone={(x.missed_pct ?? 0) >= FLAG_AT ? "danger" : "indigo"} />
                          <span className="w-10 text-right text-sm tabular-nums">{x.missed_pct === null ? "–" : `${x.missed_pct}%`}</span>
                        </span>
                      </li>
                    ))}
                </ol>
              </>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

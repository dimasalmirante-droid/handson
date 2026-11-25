"use client";

import { useActionState, useState, useTransition, type ChangeEvent } from "react";
import {
  addLesson,
  addModule,
  bumpCourseVersion,
  createCourse,
  createVoucher,
  deleteCourse,
  deleteLesson,
  deleteModule,
  disableVoucher,
  grantAccess,
  moveLesson,
  moveModule,
  revokeAccess,
  saveCourse,
  saveLesson,
  saveModule,
  saveQuiz,
  type EditorResult,
} from "@/app/admin/learning/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { suggestCourseSlug, type EditorLessonType } from "@/lib/learning/editor";

function Result({ state }: { state: EditorResult | null }) {
  if (!state || !state.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}

/** A button for a one-off action. With `confirm`, the first click asks and the second acts (no browser dialog). */
export function ActionButton({
  action,
  label,
  confirm,
  variant = "ghost",
}: {
  action: () => Promise<EditorResult>;
  label: string;
  confirm?: string;
  variant?: "ghost" | "danger" | "secondary";
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<EditorResult | null>(null);

  function run() {
    if (confirm && !asking) return setAsking(true);
    setAsking(false);
    start(async () => setResult(await action()));
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {asking && <span className="text-sm text-ink-muted">{confirm}</span>}
      <Button size="sm" variant={asking ? "danger" : variant} loading={pending} onClick={run}>
        {asking ? "Yes, continue" : label}
      </Button>
      {asking && (
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
      )}
      {result && result.message && (
        <span role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm text-success" : "text-sm font-medium text-danger"}>
          {result.message}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Course settings                                                     */
/* ------------------------------------------------------------------ */

export type CourseValues = {
  title: string;
  slug: string;
  summary: string;
  categoryId: string;
  status: "draft" | "published" | "archived";
  audience: "all_students" | "restricted";
  sequential: boolean;
  passMark: number;
  badgeName: string;
  priceMzn: number;
  sortOrder: number;
};

export function CourseForm({
  courseId,
  categories,
  initial,
}: {
  courseId?: string;
  categories: { id: number; name: string }[];
  initial?: CourseValues;
}) {
  const [state, action, pending] = useActionState(courseId ? saveCourse.bind(null, courseId) : createCourse, null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const f = state?.fields ?? {};

  function onTitle(e: ChangeEvent<HTMLInputElement>) {
    setTitle(e.currentTarget.value);
    if (!slugEdited) setSlug(suggestCourseSlug(e.currentTarget.value));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="course-title" label="Title" required error={f.title} hint="Shown to students. Write it in Portuguese.">
          <Input id="course-title" name="title" required maxLength={150} value={title} onChange={onTitle} aria-invalid={Boolean(f.title)} aria-describedby={describedBy("course-title", { hint: true, error: f.title })} />
        </Field>
        <Field id="course-slug" label="Address" required error={f.slug} hint={`The course page: /dashboard/learning/${slug || "…"}. Changing it breaks links already shared.`}>
          <Input
            id="course-slug" name="slug" required maxLength={80} autoCapitalize="none" spellCheck={false} value={slug}
            onChange={(e) => { setSlug(e.currentTarget.value); setSlugEdited(true); }}
            aria-invalid={Boolean(f.slug)} aria-describedby={describedBy("course-slug", { hint: true, error: f.slug })}
          />
        </Field>
      </div>
      <Field id="course-summary" label="Summary" error={f.summary} hint="One or two sentences on what students will be able to do.">
        <Textarea id="course-summary" name="summary" className="min-h-20" maxLength={1000} defaultValue={initial?.summary} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="course-category" label="Category" error={f.categoryId}>
          <Select id="course-category" name="categoryId" defaultValue={initial?.categoryId ?? String(categories[0]?.id ?? "")}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field id="course-audience" label="Who can take it" hint="Restricted courses open with a code or a grant.">
          <Select id="course-audience" name="audience" defaultValue={initial?.audience ?? "all_students"}>
            <option value="all_students">All students</option>
            <option value="restricted">Restricted</option>
          </Select>
        </Field>
        {courseId ? (
          <Field id="course-status" label="Status" hint="Draft and archived courses are hidden from students.">
            <Select id="course-status" name="status" defaultValue={initial?.status ?? "draft"}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="status" value="draft" />
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field id="course-pass" label="Quiz pass mark (%)" required error={f.passMark}>
          <Input id="course-pass" name="passMark" type="number" min={1} max={100} required defaultValue={initial?.passMark ?? 75} />
        </Field>
        <Field id="course-price" label="Price (MZN)" error={f.priceMzn} hint="0 for free.">
          <Input id="course-price" name="priceMzn" type="number" min={0} step={1} defaultValue={initial?.priceMzn ?? 0} />
        </Field>
        <Field id="course-badge" label="Badge name" error={f.badgeName} hint="Shown on the profile and CV.">
          <Input id="course-badge" name="badgeName" maxLength={100} defaultValue={initial?.badgeName} />
        </Field>
        <Field id="course-order" label="Order in catalogue" error={f.sortOrder} hint="Lower comes first.">
          <Input id="course-order" name="sortOrder" type="number" min={0} max={1000} defaultValue={initial?.sortOrder ?? 0} />
        </Field>
      </div>
      <Checkbox id="course-sequential" name="sequential" defaultChecked={initial?.sequential ?? true} label="Students must finish each module before the next opens" />
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>{courseId ? "Save course" : "Create draft course"}</Button>
      </div>
    </form>
  );
}

export function CourseDangerZone({ courseId, status }: { courseId: string; status: string }) {
  return (
    <div className="flex flex-col gap-4 text-[15px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-ink-muted">Raise the version after a substantial change. Earlier badges stay, with the version they were earned on.</p>
        <ActionButton action={() => bumpCourseVersion(courseId)} label="Raise version" variant="secondary" />
      </div>
      {status === "draft" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-ink-muted">Delete this draft. Only possible while no student has access or progress.</p>
          <ActionButton action={() => deleteCourse(courseId)} label="Delete course" variant="danger" confirm="Delete this course and all its lessons?" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modules and lessons                                                 */
/* ------------------------------------------------------------------ */

export function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(addModule.bind(null, courseId), null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Result state={state} />
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <Field id="new-module-title" label="New module" error={state?.fields?.title}>
          <Input id="new-module-title" name="title" required maxLength={150} placeholder="Ex.: O seu CV" />
        </Field>
        <Field id="new-module-objective" label="Objective (optional)">
          <Input id="new-module-objective" name="objective" maxLength={1000} placeholder="No fim, o estudante consegue…" />
        </Field>
        <Button type="submit" variant="secondary" loading={pending}>Add module</Button>
      </div>
    </form>
  );
}

export function ModuleHeader({
  module,
  first,
  last,
}: {
  module: { id: string; position: number; title: string; objective: string | null };
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveModule.bind(null, module.id), null);

  if (editing) {
    return (
      <form action={action} className="flex flex-col gap-3">
        <Result state={state} />
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field id={`m-${module.id}-title`} label="Module title" error={state?.fields?.title}>
            <Input id={`m-${module.id}-title`} name="title" required maxLength={150} defaultValue={module.title} />
          </Field>
          <Field id={`m-${module.id}-objective`} label="Objective">
            <Input id={`m-${module.id}-objective`} name="objective" maxLength={1000} defaultValue={module.objective ?? ""} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={pending}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Close</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-[17px]">Module {module.position}: {module.title}</h3>
        {module.objective && <p className="text-sm text-ink-muted">{module.objective}</p>}
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Rename</Button>
        {!first && <ActionButton action={() => moveModule(module.id, "up")} label="Move up" />}
        {!last && <ActionButton action={() => moveModule(module.id, "down")} label="Move down" />}
        <ActionButton action={() => deleteModule(module.id)} label="Delete" confirm="Delete this module and its lessons?" />
      </div>
    </div>
  );
}

export function LessonRowActions({ lessonId, first, last }: { lessonId: string; first: boolean; last: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {!first && <ActionButton action={() => moveLesson(lessonId, "up")} label="Up" />}
      {!last && <ActionButton action={() => moveLesson(lessonId, "down")} label="Down" />}
    </div>
  );
}

export function AddLessonForm({ moduleId }: { moduleId: string }) {
  const [state, action, pending] = useActionState(addLesson.bind(null, moduleId), null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Result state={state} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field id={`l-new-${moduleId}`} label="New lesson" error={state?.fields?.title}>
          <Input id={`l-new-${moduleId}`} name="title" required maxLength={150} />
        </Field>
        <Field id={`l-new-${moduleId}-type`} label="Type">
          <Select id={`l-new-${moduleId}-type`} name="type" defaultValue="text">
            <option value="text">Reading</option>
            <option value="video">Video (YouTube)</option>
            <option value="quiz">Quiz</option>
            <option value="link">External link</option>
          </Select>
        </Field>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>Add lesson</Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Lesson content                                                      */
/* ------------------------------------------------------------------ */

export type LessonValues = {
  title: string;
  type: EditorLessonType;
  videoUrl: string;
  body: string;
  linkUrl: string;
  durationMinutes: string;
  isPreview: boolean;
};

const TYPE_LABEL: Record<EditorLessonType, string> = {
  text: "Reading",
  video: "Video (YouTube)",
  quiz: "Quiz",
  link: "External link",
  file: "File",
};

export function LessonForm({ lessonId, initial }: { lessonId: string; initial: LessonValues }) {
  const [state, action, pending] = useActionState(saveLesson.bind(null, lessonId), null);
  const [type, setType] = useState<EditorLessonType>(initial.type);
  const f = state?.fields ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Field id="lesson-title" label="Title" required error={f.title}>
          <Input id="lesson-title" name="title" required maxLength={150} defaultValue={initial.title} />
        </Field>
        <Field id="lesson-type" label="Type">
          <Select id="lesson-type" name="type" value={type} onChange={(e) => setType(e.currentTarget.value as EditorLessonType)}>
            {(["text", "video", "quiz", "link"] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </Select>
        </Field>
        <Field id="lesson-duration" label="Minutes" error={f.durationMinutes} hint="Estimated time.">
          <Input id="lesson-duration" name="durationMinutes" type="number" min={1} max={600} defaultValue={initial.durationMinutes} />
        </Field>
      </div>
      {type === "video" && (
        <Field id="lesson-video" label="YouTube link" required error={f.videoUrl} hint="Students watch it embedded, without YouTube tracking cookies.">
          <Input id="lesson-video" name="videoUrl" type="url" required placeholder="https://www.youtube.com/watch?v=…" defaultValue={initial.videoUrl} />
        </Field>
      )}
      {type === "link" && (
        <Field id="lesson-link" label="Link" required error={f.linkUrl}>
          <Input id="lesson-link" name="linkUrl" type="url" required placeholder="https://" defaultValue={initial.linkUrl} />
        </Field>
      )}
      <Field
        id="lesson-body"
        label={type === "text" ? "Text" : type === "quiz" ? "Introduction (optional)" : "Notes for students (optional)"}
        required={type === "text"}
        error={f.body}
        hint="Paragraphs are separated by a blank line. Start a line with “### ” for a heading, “- ” or “1. ” for a list item, and wrap **bold** text in two asterisks."
      >
        <Textarea id="lesson-body" name="body" className="min-h-72 font-mono text-[14px]" maxLength={20000} required={type === "text"} defaultValue={initial.body} />
      </Field>
      <Checkbox id="lesson-preview" name="isPreview" defaultChecked={initial.isPreview} label="Free preview: students without access can open this lesson" />
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>Save lesson</Button>
      </div>
    </form>
  );
}

export function DeleteLessonButton({ lessonId }: { lessonId: string }) {
  return <ActionButton action={() => deleteLesson(lessonId)} label="Delete lesson" variant="danger" confirm="Delete this lesson?" />;
}

type Question = { prompt: string; options: string[]; correctIndex: number; explanation: string };

const blankQuestion = (): Question => ({ prompt: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" });

export function QuizEditor({ lessonId, initial }: { lessonId: string; initial: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(initial.length ? initial : [blankQuestion()]);
  const [result, setResult] = useState<EditorResult | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<Question>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const swap = (i: number, j: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[15px] text-ink-muted">
        Students see the questions and options in a different order on every attempt. Correct answers and explanations are shown only after they pass.
        Changes are saved together when you press “Save questions”.
      </p>
      {questions.map((q, i) => (
        <fieldset key={i} className="flex flex-col gap-3 rounded-[14px] border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Question {i + 1}</legend>
          <Field id={`q${i}-prompt`} label="Question" required>
            <Textarea id={`q${i}-prompt`} className="min-h-16" maxLength={1000} value={q.prompt} onChange={(e) => update(i, { prompt: e.currentTarget.value })} />
          </Field>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={`Options for question ${i + 1}; select the correct one`}>
            <p className="text-sm text-ink-muted">Options (2 to 6). Select the correct one. Empty options are ignored.</p>
            {q.options.map((o, k) => (
              <div key={k} className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`q${i}-correct`}
                  aria-label={`Option ${k + 1} is correct`}
                  className="size-5 accent-indigo"
                  checked={q.correctIndex === k}
                  onChange={() => update(i, { correctIndex: k })}
                />
                <Input
                  aria-label={`Option ${k + 1}`}
                  maxLength={500}
                  value={o}
                  onChange={(e) => update(i, { options: q.options.map((x, m) => (m === k ? e.currentTarget.value : x)) })}
                />
                {q.options.length > 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove option ${k + 1}`}
                    onClick={() =>
                      update(i, {
                        options: q.options.filter((_, m) => m !== k),
                        correctIndex: q.correctIndex === k ? 0 : q.correctIndex > k ? q.correctIndex - 1 : q.correctIndex,
                      })
                    }
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {q.options.length < 6 && (
              <div>
                <Button size="sm" variant="ghost" onClick={() => update(i, { options: [...q.options, ""] })}>Add option</Button>
              </div>
            )}
          </div>
          <Field id={`q${i}-explanation`} label="Explanation (shown after passing)">
            <Textarea id={`q${i}-explanation`} className="min-h-16" maxLength={1000} value={q.explanation} onChange={(e) => update(i, { explanation: e.currentTarget.value })} />
          </Field>
          <div className="flex flex-wrap gap-1">
            {i > 0 && <Button size="sm" variant="ghost" onClick={() => swap(i, i - 1)}>Move up</Button>}
            {i < questions.length - 1 && <Button size="sm" variant="ghost" onClick={() => swap(i, i + 1)}>Move down</Button>}
            <Button size="sm" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>Remove question</Button>
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])} disabled={questions.length >= 50}>
          Add question
        </Button>
        <Button loading={pending} onClick={() => start(async () => setResult(await saveQuiz(lessonId, questions)))}>Save questions</Button>
      </div>
      <Result state={result} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Access                                                              */
/* ------------------------------------------------------------------ */

export function VoucherForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(createVoucher.bind(null, courseId), null);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <Result state={state} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field id="voucher-code" label="Code" required error={f.code} hint="Ex.: UEM-2026">
          <Input id="voucher-code" name="code" required maxLength={40} autoCapitalize="characters" spellCheck={false} />
        </Field>
        <Field id="voucher-uses" label="Maximum uses" error={f.maxUses} hint="Empty for no limit.">
          <Input id="voucher-uses" name="maxUses" type="number" min={1} />
        </Field>
        <Field id="voucher-expires" label="Valid until" error={f.expiresOn} hint="Maputo time, end of day.">
          <Input id="voucher-expires" name="expiresOn" type="date" />
        </Field>
        <Field id="voucher-sponsor" label="Sponsor (optional)" error={f.sponsorName}>
          <Input id="voucher-sponsor" name="sponsorName" maxLength={150} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>Create code</Button>
      </div>
    </form>
  );
}

export function DisableVoucherButton({ voucherId }: { voucherId: string }) {
  return <ActionButton action={() => disableVoucher(voucherId)} label="Disable" confirm="Stop this code from being used?" />;
}

export function GrantForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(grantAccess.bind(null, courseId), null);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <Result state={state} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field id="grant-email" label="Student's email" required error={f.email}>
          <Input id="grant-email" name="email" type="email" required autoComplete="off" />
        </Field>
        <Field id="grant-source" label="Reason">
          <Select id="grant-source" name="source" defaultValue="purchase">
            <option value="purchase">Paid</option>
            <option value="sponsor">Sponsored</option>
            <option value="admin_grant">Handson grant</option>
          </Select>
        </Field>
        <Field id="grant-amount" label="Amount paid (MZN)" error={f.amountMzn}>
          <Input id="grant-amount" name="amountMzn" type="number" min={0} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="grant-sponsor" label="Sponsor (optional)" error={f.sponsorName}>
          <Input id="grant-sponsor" name="sponsorName" maxLength={150} />
        </Field>
        <Field id="grant-note" label="Note (optional)" error={f.note} hint="For example the M-Pesa reference. No card or account numbers.">
          <Input id="grant-note" name="note" maxLength={500} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>Give access</Button>
      </div>
    </form>
  );
}

export function RevokeAccessButton({ accessId, courseId }: { accessId: string; courseId: string }) {
  return <ActionButton action={() => revokeAccess(accessId, courseId)} label="Remove" confirm="Remove this student's access?" />;
}

/**
 * Validation for the admin course editor. Limits mirror the database checks in
 * 20261123000100_lms_foundation.sql so errors appear in the form, not as
 * database refusals.
 */
import { z } from "zod";

export const COURSE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const LESSON_TYPES = ["video", "text", "quiz", "file", "link"] as const;
export type EditorLessonType = (typeof LESSON_TYPES)[number];

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null);

export const courseSchema = z.object({
  title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(150, "Keep the title to 150 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "The address needs at least 3 characters.")
    .max(80, "Keep the address to 80 characters.")
    .regex(COURSE_SLUG, "Use lower-case letters, numbers and single hyphens."),
  summary: optionalText(1000, "Keep the summary to 1,000 characters."),
  categoryId: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Choose a category."),
  status: z.enum(["draft", "published", "archived"]),
  audience: z.enum(["all_students", "restricted"]),
  sequential: z.boolean(),
  passMark: z.coerce.number().int("Use a whole number.").min(1, "The pass mark is between 1 and 100.").max(100, "The pass mark is between 1 and 100."),
  badgeName: z
    .string()
    .trim()
    .max(100, "Keep the badge name to 100 characters.")
    .refine((v) => v === "" || v.length >= 3, "Use at least 3 characters for the badge name.")
    .transform((v) => v || null),
  priceMzn: z.coerce.number().int("Use a whole number of meticais.").min(0, "The price cannot be negative.").max(10_000_000, "The price is too high."),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const moduleSchema = z.object({
  title: z.string().trim().min(2, "Enter a module title.").max(150, "Keep the title to 150 characters."),
  objective: optionalText(1000, "Keep the objective to 1,000 characters."),
});

const youtube = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\//;

export const lessonSchema = z
  .object({
    title: z.string().trim().min(2, "Enter a lesson title.").max(150, "Keep the title to 150 characters."),
    type: z.enum(LESSON_TYPES),
    videoUrl: optionalText(500, "The video link is too long."),
    body: optionalText(20_000, "Keep the text to 20,000 characters."),
    linkUrl: optionalText(500, "The link is too long."),
    durationMinutes: z
      .string()
      .trim()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 600), "Enter the duration in whole minutes (1 to 600)."),
    isPreview: z.boolean(),
  })
  .superRefine((l, ctx) => {
    if (l.videoUrl && !youtube.test(l.videoUrl)) ctx.addIssue({ code: "custom", path: ["videoUrl"], message: "Use a YouTube link starting with https://." });
    if (l.type === "video" && !l.videoUrl) ctx.addIssue({ code: "custom", path: ["videoUrl"], message: "A video lesson needs a YouTube link." });
    if (l.type === "text" && !l.body) ctx.addIssue({ code: "custom", path: ["body"], message: "A text lesson needs its text." });
    if (l.linkUrl && !/^https:\/\//.test(l.linkUrl)) ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Use a link starting with https://." });
    if (l.type === "link" && !l.linkUrl) ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "A link lesson needs its link." });
  });
export type LessonInput = z.infer<typeof lessonSchema>;

export const questionSchema = z
  .object({
    prompt: z.string().trim().min(3, "Write the question.").max(1000, "Keep the question to 1,000 characters."),
    options: z
      .array(z.string().trim().max(500, "Keep each option to 500 characters."))
      .transform((opts) => opts.filter((o) => o.length > 0))
      .pipe(z.array(z.string()).min(2, "Give at least 2 options.").max(6, "Use at most 6 options.")),
    correctIndex: z.number().int().min(0),
    explanation: optionalText(1000, "Keep the explanation to 1,000 characters."),
  })
  .refine((q) => q.correctIndex < q.options.length, { path: ["correctIndex"], message: "Choose which option is correct." });

export const quizSchema = z.array(questionSchema).max(50, "Use at most 50 questions.");
export type QuestionInput = z.infer<typeof questionSchema>;

export const voucherSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,40}$/, "Use 4 to 40 capital letters, numbers or hyphens, for example UEM-2026."),
  maxUses: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1), "Enter a whole number of uses, or leave it empty for no limit."),
  expiresOn: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a valid date."),
  sponsorName: optionalText(150, "Keep the sponsor name to 150 characters."),
});

export const grantSchema = z.object({
  email: z.email("Enter the student's email address.").transform((v) => v.trim().toLowerCase()),
  source: z.enum(["purchase", "sponsor", "admin_grant"]),
  amountMzn: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : 0))
    .refine((v) => Number.isInteger(v) && v >= 0, "Enter the amount in whole meticais."),
  sponsorName: optionalText(150, "Keep the sponsor name to 150 characters."),
  note: optionalText(500, "Keep the note to 500 characters."),
});

/** Reasons a course cannot be published yet; empty when it can. */
export function publishProblems(outline: {
  modules: { title: string; lessons: { title: string; type: EditorLessonType; questions: number }[] }[];
}): string[] {
  const problems: string[] = [];
  const lessons = outline.modules.flatMap((m) => m.lessons);
  if (lessons.length === 0) problems.push("Add at least one lesson.");
  for (const m of outline.modules) if (m.lessons.length === 0) problems.push(`Module “${m.title}” has no lessons.`);
  for (const l of lessons) if (l.type === "quiz" && l.questions === 0) problems.push(`Quiz “${l.title}” has no questions.`);
  return problems;
}

/** Suggest a course address from its title: "Preparação para o Trabalho" → "preparacao-para-o-trabalho". */
export function suggestCourseSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

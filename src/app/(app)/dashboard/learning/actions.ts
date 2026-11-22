"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type QuizResult = {
  score: number;
  pass_mark: number;
  passed: boolean;
  course_completed: boolean;
  questions: { question_id: string; correct: boolean; correct_index: number; explanation: string | null }[];
};

export type LearningResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const uuid = z.uuid();
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);

/** Map database refusals to messages a student can act on; log the rest. */
function refusal(error: { code?: string; message: string }, action: string): string {
  if (error.message.includes("previous modules")) return "Complete the previous modules first.";
  if (error.message.includes("No access")) return "You do not have access to this course.";
  if (error.message.includes("Answer every question")) return "Answer every question.";
  console.error(`${action} failed`, error.code, error.message);
  return "Something went wrong. Please try again.";
}

function refresh(courseSlug: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/dashboard/learning/${courseSlug}`, "layout");
}

/** Mark a video, text, file or link lesson as complete. */
export async function completeLesson(lessonId: string, courseSlug: string): Promise<LearningResult<{ courseCompleted: boolean }>> {
  await requireStudent("/dashboard/learning");
  if (!uuid.safeParse(lessonId).success || !slug.safeParse(courseSlug).success) return { ok: false, error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_lesson", { p_lesson: lessonId });
  if (error) return { ok: false, error: refusal(error, "complete_lesson") };
  refresh(courseSlug);
  return { ok: true, data: { courseCompleted: data === true } };
}

/** Grade a quiz on the server. answers[i] = zero-based option chosen for question i. */
export async function submitQuiz(lessonId: string, courseSlug: string, answers: number[]): Promise<LearningResult<QuizResult>> {
  await requireStudent("/dashboard/learning");
  const parsed = z.array(z.number().int().min(0).max(5)).min(1).max(50).safeParse(answers);
  if (!uuid.safeParse(lessonId).success || !slug.safeParse(courseSlug).success || !parsed.success) {
    return { ok: false, error: "Answer every question." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz", { p_lesson: lessonId, p_answers: parsed.data });
  if (error) return { ok: false, error: refusal(error, "submit_quiz") };
  refresh(courseSlug);
  return { ok: true, data: data as QuizResult };
}

export type VoucherState = { error?: string; ok?: boolean } | undefined;

/** Redeem a voucher code from a form. */
export async function redeemVoucher(_prev: VoucherState, formData: FormData): Promise<VoucherState> {
  await requireStudent("/dashboard/learning");
  const code = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,40}$/)
    .safeParse(formData.get("code"));
  if (!code.success) return { error: "This code is not valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_course_voucher", { p_code: code.data });
  if (error) {
    if (error.message.includes("not valid")) return { error: "This code is not valid." };
    console.error("redeem_course_voucher failed", error.code, error.message);
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

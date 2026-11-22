"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitQuiz, type QuizResult } from "@/app/(app)/dashboard/learning/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { QuizQuestion } from "@/lib/learning/model";
import { T, useT } from "@/i18n/client";

/** A quiz graded on the server. Shows which answers were right only after submitting. */
export function Quiz({
  lessonId,
  courseSlug,
  questions,
  passMark,
  bestScore,
  nextHref,
}: {
  lessonId: string;
  courseSlug: string;
  questions: QuizQuestion[];
  passMark: number;
  bestScore: number | null;
  nextHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unanswered = answers.filter((a) => a === null).length;

  const submit = () => {
    if (unanswered > 0) {
      setError("Answer every question.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await submitQuiz(lessonId, courseSlug, answers as number[]);
      if (!r.ok) setError(r.error);
      else if (r.data) {
        setResult(r.data);
        router.refresh();
      }
    });
  };

  const retry = () => {
    setResult(null);
    setAnswers(questions.map(() => null));
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[15px] text-ink-muted">
        {t("Answer all {n} questions. You need {mark}% to pass, and you can try again as many times as you like.", { n: questions.length, mark: passMark })}
        {bestScore !== null && ` ${t("Your best score: {score}%.", { score: bestScore })}`}
      </p>

      <ol className="flex flex-col gap-6">
        {questions.map((q, qi) => {
          const outcome = result?.questions[qi];
          return (
            <li key={q.id}>
              <fieldset disabled={!!result || pending}>
                <legend className="mb-3 font-semibold">
                  {qi + 1}. {q.prompt}
                </legend>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, oi) => {
                    const chosen = answers[qi] === oi;
                    const isCorrect = outcome && outcome.correct_index === oi;
                    const isWrongChoice = outcome && chosen && !outcome.correct;
                    return (
                      <label
                        key={oi}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-[12px] border px-4 py-3 text-[15px] transition-colors",
                          chosen && !outcome ? "border-indigo bg-indigo-soft" : "border-line bg-surface-raised hover:border-line-strong",
                          isCorrect && "border-success bg-success-soft",
                          isWrongChoice && "border-danger bg-danger-soft",
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          className="mt-1 accent-indigo"
                          checked={chosen}
                          onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
                {outcome && (
                  <p className={cn("mt-2 text-sm", outcome.correct ? "text-success" : "text-danger")}>
                    {outcome.correct ? t("Correct.") : t("Not quite.")} {outcome.explanation}
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {error && <Alert tone="danger">{t(error)}</Alert>}

      {result ? (
        <div className="flex flex-col gap-4">
          <Alert tone={result.passed ? "success" : "warning"} title={result.passed ? t("You passed") : t("Not yet")}>
            {t("You scored {score}%. The pass mark is {mark}%.", { score: result.score, mark: result.pass_mark })}
            {result.course_completed && ` ${t("You have completed the course and earned the badge.")}`}
          </Alert>
          <div className="flex flex-wrap gap-3">
            {result.passed ? (
              <Button onClick={() => router.push(nextHref)}><T>{"Continue"}</T></Button>
            ) : (
              <Button onClick={retry}><T>{"Try again"}</T></Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <Button onClick={submit} loading={pending}><T>{"Submit answers"}</T></Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeLesson } from "@/app/(app)/dashboard/learning/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { T, useT } from "@/i18n/client";

/** Marks a non-quiz lesson as complete, then moves to the next lesson (or to the completion page when the course is finished). */
export function CompleteButton({ lessonId, courseSlug, nextHref, completedHref }: { lessonId: string; courseSlug: string; nextHref: string; completedHref: string }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{t(error)}</Alert>}
      <div>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await completeLesson(lessonId, courseSlug);
              if (!r.ok) setError(r.error);
              else router.push(r.data?.courseCompleted ? completedHref : nextHref);
            })
          }
        >
          <T>{"Mark as complete and continue"}</T>
        </Button>
      </div>
    </div>
  );
}

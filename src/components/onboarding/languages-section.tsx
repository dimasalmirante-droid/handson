"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addLanguage, removeLanguage, updateLanguageLevel } from "@/app/(app)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/field";
import type { Language } from "@/lib/data/catalogues";
import type { StudentLanguage } from "@/lib/data/student";
import { LANGUAGE_LEVEL_LABELS } from "@/lib/onboarding/labels";
import { T, useT } from "@/i18n/client";

const LEVELS = Object.entries(LANGUAGE_LEVEL_LABELS).map(([value, label]) => ({ value, label }));

/** Languages the student speaks, each with a level. Each change saves immediately. */
export function LanguagesSection({ mine, languages }: { mine: StudentLanguage[]; languages: Language[] }) {
  const router = useRouter();
  const [languageId, setLanguageId] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();

  const owned = new Set(mine.map((l) => l.language_id));
  const nameOf = (id: number) => languages.find((l) => l.id === id)?.name ?? "Language";

  const run = (fn: () => Promise<{ ok: boolean; error?: string; fields?: Record<string, string | undefined> }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? Object.values(r.fields ?? {})[0] ?? "Could not save. Please try again.");
      else after?.();
      router.refresh();
    });

  return (
    <section className="mt-10" aria-labelledby="my-languages">
      <h2 id="my-languages" className="text-xl"><T>{"Languages"}</T></h2>
      <p className="mt-1 text-[15px] text-ink-muted"><T>{"Include Portuguese, English and any national languages you speak."}</T></p>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}

      <div className="mt-5 grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] lg:grid-cols-[minmax(0,1fr)_180px_auto]">
        <Field id="language-id" label="Language">
          <Select id="language-id" value={languageId} onChange={(e) => setLanguageId(e.target.value)}>
            <option value="">{t("Select a language")}</option>
            {languages
              .filter((l) => !owned.has(l.id))
              .map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
          </Select>
        </Field>
        <Field id="language-level" label="Level">
          <Select id="language-level" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{t(l.label)}</option>)}
          </Select>
        </Field>
        <Button
          type="button"
          variant="secondary"
          disabled={!languageId || pending}
          onClick={() => run(() => addLanguage({ languageId, level }), () => setLanguageId(""))}
        >
          <T>{"Add language"}</T>
        </Button>
      </div>

      {mine.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-[16px] border border-line">
          {mine.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">{nameOf(l.language_id)}</span>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={t("Level for {name}", { name: nameOf(l.language_id) })}
                  className="h-10 w-[170px]"
                  value={l.level}
                  onChange={(e) => run(() => updateLanguageLevel(l.id, e.target.value))}
                >
                  {LEVELS.map((v) => <option key={v.value} value={v.value}>{t(v.label)}</option>)}
                </Select>
                <Button size="sm" variant="ghost" aria-label={t("Remove {name}", { name: nameOf(l.language_id) })} onClick={() => run(() => removeLanguage(l.id))}>
                  <T>{"Remove"}</T>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

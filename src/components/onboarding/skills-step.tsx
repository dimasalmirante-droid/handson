"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addSkill, continueFrom, removeSkill, updateSkillLevel } from "@/app/(app)/onboarding/actions";
import { SearchPicker, StepFooter } from "@/components/onboarding/wizard";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { Skill, SkillCategory } from "@/lib/data/catalogues";
import type { StudentSkill } from "@/lib/data/student";

const LEVELS = [
  { value: "beginner", label: "Beginner", hint: "Learning the basics" },
  { value: "intermediate", label: "Intermediate", hint: "Can work independently" },
  { value: "advanced", label: "Advanced", hint: "Confident and experienced" },
  { value: "expert", label: "Expert", hint: "Can teach others" },
];

export function SkillsStep({
  mine,
  skills,
  categories,
  embedded = false,
}: {
  embedded?: boolean;
  mine: StudentSkill[];
  skills: Skill[];
  categories: SkillCategory[];
}) {
  const router = useRouter();
  const [level, setLevel] = useState("intermediate");
  const [category, setCategory] = useState<number>(categories[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const owned = new Set(mine.map((s) => s.skill_id).filter((id): id is number => id !== null));
  const nameOf = (s: StudentSkill) => s.custom_skill_name ?? skills.find((k) => k.id === s.skill_id)?.name ?? "Skill";

  const run = (fn: () => Promise<{ ok: boolean; error?: string; fields?: Record<string, string | undefined> }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? Object.values(r.fields ?? {})[0] ?? "Could not save. Please try again.");
      router.refresh();
    });

  const add = (skillId?: number, customName?: string) => run(() => addSkill({ skillId, customName, proficiency: level }));

  return (
    <div>
      {error && <Alert tone="danger" className="mb-6">{error}</Alert>}

      <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
        <Field id="skill-search" label="Find a skill" hint="Search by name, or type your own and choose “Add”.">
          <SearchPicker
            id="skill-search"
            placeholder="e.g. Excel, Contabilidade, Python, English…"
            items={skills
              .filter((s) => !owned.has(s.id))
              .map((s) => ({
                id: String(s.id),
                label: s.name,
                detail: categories.find((c) => c.id === s.categoryId)?.name,
                keywords: s.aliases.join(" "),
              }))}
            onSelect={(item) => add(Number(item.id))}
            onCreate={(text) => add(undefined, text)}
            describedBy="skill-search-hint"
          />
        </Field>
        <Field id="level" label="Level for new skills" hint={LEVELS.find((l) => l.value === level)?.hint}>
          <Select id="level" value={level} onChange={(e) => setLevel(e.target.value)} aria-describedby="level-hint">
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
        </Field>
      </div>

      <div className="mt-8">
        <p className="text-sm font-semibold">Or browse by category</p>
        <div role="tablist" aria-label="Skill categories" className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-[var(--radius-pill)] px-3.5 py-1.5 text-sm font-medium",
                category === c.id ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-inset ring-line hover:ring-line-strong",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="mt-4 flex flex-wrap gap-2">
          {skills
            .filter((s) => s.categoryId === category)
            .map((s) => {
              const has = owned.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={has || pending}
                  onClick={() => add(s.id)}
                  className={cn(
                    "rounded-[var(--radius-pill)] px-4 py-2 text-[15px] font-medium transition-colors",
                    has ? "bg-indigo-soft text-indigo" : "bg-surface-raised ring-1 ring-inset ring-line-strong hover:bg-indigo-soft",
                  )}
                  aria-label={has ? `${s.name} (added)` : `Add ${s.name}`}
                >
                  {has ? "✓ " : "+ "}
                  {s.name}
                </button>
              );
            })}
        </div>
      </div>

      <section className="mt-10" aria-labelledby="my-skills">
        <div className="flex items-baseline justify-between">
          <h2 id="my-skills" className="text-xl">Your skills</h2>
          <p className="text-sm text-ink-muted">{mine.length} added{mine.length < 3 ? ` · add at least ${3 - mine.length} more` : ""}</p>
        </div>
        {mine.length === 0 ? (
          <p className="mt-3 text-ink-muted">No skills yet. Add at least three, including languages and software you use.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-[16px] border border-line">
            {mine.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{nameOf(s)}</span>
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Level for ${nameOf(s)}`}
                    className="h-10 w-[170px]"
                    value={s.proficiency}
                    onChange={(e) => run(() => updateSkillLevel(s.id, e.target.value))}
                  >
                    {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </Select>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${nameOf(s)}`} onClick={() => run(() => removeSkill(s.id))}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!embedded && <StepFooter back="/onboarding/education" onContinue={() => continueFrom(3)} />}
    </div>
  );
}

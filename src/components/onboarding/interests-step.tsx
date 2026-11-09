"use client";

import { useState } from "react";
import { continueFrom, saveInterests } from "@/app/(app)/onboarding/actions";
import { ChipGroup, RadioCards, SaveIndicator, StepFooter, useAutosave } from "@/components/onboarding/wizard";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { Option } from "@/lib/data/catalogues";
import type { Interests } from "@/lib/data/student";
import type { InterestsInput } from "@/lib/validation/profile";

const ARRANGEMENTS = [
  { value: "on_site", label: "On site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

const AVAILABILITY = [
  { value: "immediately", label: "Immediately" },
  { value: "within_1_month", label: "Within 1 month" },
  { value: "within_3_months", label: "Within 3 months" },
  { value: "after_graduation", label: "After I graduate" },
  { value: "specific_date", label: "From a specific date" },
] as const;

const DURATIONS = [
  { value: "up_to_3_months", label: "Up to 3 months" },
  { value: "3_to_6_months", label: "3 to 6 months" },
  { value: "6_to_12_months", label: "6 to 12 months" },
  { value: "over_12_months", label: "More than 12 months" },
  { value: "flexible", label: "Flexible" },
] as const;

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

function toInput(i: Interests | null): InterestsInput {
  return {
    industryIds: i?.industryIds ?? [],
    jobFunctionIds: i?.jobFunctionIds ?? [],
    provinceIds: i?.provinceIds ?? [],
    preferredRoles: i?.preferred_roles ?? [],
    careerInterests: i?.career_interests ?? null,
    workArrangements: (i?.work_arrangements ?? []) as InterestsInput["workArrangements"],
    availability: (i?.availability ?? null) as InterestsInput["availability"],
    availableFrom: i?.available_from ?? null,
    internshipDuration: (i?.internship_duration ?? null) as InterestsInput["internshipDuration"],
    hasWorkExperience: i?.has_work_experience ?? null,
    willingToRelocate: i?.willing_to_relocate ?? null,
  };
}

const yn = (b: boolean | null) => (b === null ? null : b ? "yes" : "no");

export function InterestsStep({
  initial,
  industries,
  jobFunctions,
  provinces,
  embedded = false,
}: {
  embedded?: boolean;
  initial: Interests | null;
  industries: Option[];
  jobFunctions: Option[];
  provinces: Option[];
}) {
  const [v, setV] = useState<InterestsInput>(() => toInput(initial));
  const [roleDraft, setRoleDraft] = useState("");
  const autosave = useAutosave(saveInterests, 700);
  const fieldErrors = autosave.result?.ok === false ? autosave.result.fields ?? {} : {};

  const update = (patch: Partial<InterestsInput>) => {
    const next = { ...v, ...patch };
    setV(next);
    autosave.schedule(next);
  };

  const addRole = () => {
    const role = roleDraft.trim();
    if (role.length < 2 || v.preferredRoles.length >= 5 || v.preferredRoles.some((r) => r.toLowerCase() === role.toLowerCase())) return;
    update({ preferredRoles: [...v.preferredRoles, role] });
    setRoleDraft("");
  };

  return (
    <div className="flex flex-col gap-10">
      <ChipGroup
        legend="Industries that interest you"
        hint="Choose up to 5."
        required
        max={5}
        options={industries.map((o) => ({ value: o.id, label: o.name }))}
        selected={v.industryIds}
        onChange={(industryIds) => update({ industryIds })}
      />

      <ChipGroup
        legend="Job functions"
        hint="The kind of work you want to do. Choose up to 5."
        required
        max={5}
        options={jobFunctions.map((o) => ({ value: o.id, label: o.name }))}
        selected={v.jobFunctionIds}
        onChange={(jobFunctionIds) => update({ jobFunctionIds })}
      />

      <div>
        <Field id="role" label="Preferred internship or entry-level roles" hint="For example: Audit trainee, Junior developer, HR intern. Up to 5.">
          <div className="flex gap-2">
            <Input
              id="role"
              value={roleDraft}
              maxLength={80}
              disabled={v.preferredRoles.length >= 5}
              onChange={(e) => setRoleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRole();
                }
              }}
              aria-describedby="role-hint"
            />
            <Button variant="secondary" onClick={addRole} disabled={v.preferredRoles.length >= 5}>Add</Button>
          </div>
        </Field>
        {v.preferredRoles.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {v.preferredRoles.map((r) => (
              <li key={r} className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-indigo-soft py-1.5 pl-4 pr-1.5 text-[15px] font-medium text-indigo">
                {r}
                <button
                  type="button"
                  aria-label={`Remove ${r}`}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-white"
                  onClick={() => update({ preferredRoles: v.preferredRoles.filter((x) => x !== r) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ChipGroup
        legend="Where you would like to work"
        hint="Choose any provinces that suit you."
        required
        options={provinces.map((o) => ({ value: o.id, label: o.name }))}
        selected={v.provinceIds}
        onChange={(provinceIds) => update({ provinceIds })}
      />

      <ChipGroup
        legend="Work arrangement"
        required
        options={ARRANGEMENTS.map((o) => ({ value: o.value, label: o.label }))}
        selected={v.workArrangements}
        onChange={(workArrangements) => update({ workArrangements })}
      />

      <div className="flex flex-col gap-4">
        <RadioCards
          legend="When can you start?"
          name="availability"
          required
          options={AVAILABILITY.map((o) => ({ value: o.value, label: o.label }))}
          value={v.availability}
          onChange={(availability) => update({ availability })}
        />
        {v.availability === "specific_date" && (
          <Field id="availableFrom" label="Available from" required error={fieldErrors.availableFrom} className="sm:max-w-xs">
            <Input id="availableFrom" type="date" value={v.availableFrom ?? ""} onChange={(e) => update({ availableFrom: e.target.value || null })} />
          </Field>
        )}
      </div>

      <RadioCards
        legend="Preferred internship duration"
        name="duration"
        options={DURATIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={v.internshipDuration}
        onChange={(internshipDuration) => update({ internshipDuration })}
      />

      <div className="grid gap-8 sm:grid-cols-2">
        <RadioCards
          legend="Do you have previous work experience?"
          name="experience"
          options={YES_NO.map((o) => ({ value: o.value, label: o.label }))}
          value={yn(v.hasWorkExperience)}
          onChange={(x) => update({ hasWorkExperience: x === "yes" })}
        />
        <RadioCards
          legend="Are you willing to relocate?"
          name="relocate"
          options={YES_NO.map((o) => ({ value: o.value, label: o.label }))}
          value={yn(v.willingToRelocate)}
          onChange={(x) => update({ willingToRelocate: x === "yes" })}
        />
      </div>

      <Field id="careerInterests" label="Career interests" hint="Optional. In a few sentences, what kind of career are you working towards?" error={fieldErrors.careerInterests}>
        <Textarea
          id="careerInterests"
          maxLength={1000}
          value={v.careerInterests ?? ""}
          onChange={(e) => update({ careerInterests: e.target.value })}
          onBlur={() => autosave.flush()}
          aria-describedby="careerInterests-hint"
        />
      </Field>

      {embedded ? (

        <SaveIndicator status={autosave.status} />

      ) : (
      <StepFooter
        back="/onboarding/skills"
        status={autosave.status}
        onContinue={async () => {
          const r = await autosave.flush();
          if (r && !r.ok) return r;
          return continueFrom(4);
        }}
      />

      )}
    </div>
  );
}

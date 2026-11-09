"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { continueFrom, deleteExperience, saveExperience } from "@/app/(app)/onboarding/actions";
import { StepFooter, useLocalDraft } from "@/components/onboarding/wizard";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import type { ExperienceRecord } from "@/lib/data/student";
import { EXPERIENCE_LABELS } from "@/lib/onboarding/labels";
import type { FieldErrors } from "@/lib/validation/profile";

type Values = Record<string, string>;

const EMPTY: Values = {
  id: "", organisation: "", roleTitle: "", experienceType: "", location: "", startMonth: "", endMonth: "",
  isCurrent: "", description: "", achievements: "",
};

const monthLabel = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";

function toValues(r: ExperienceRecord): Values {
  return {
    id: r.id, organisation: r.organisation, roleTitle: r.role_title, experienceType: r.experience_type,
    location: r.location ?? "", startMonth: r.start_date.slice(0, 7), endMonth: r.end_date?.slice(0, 7) ?? "",
    isCurrent: r.is_current ? "on" : "", description: r.description ?? "", achievements: r.achievements ?? "",
  };
}

export function ExperienceStep({ userId, records }: { userId: string; records: ExperienceRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Values | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  return (
    <div>
      {message && <Alert tone="success" className="mb-6">{message}</Alert>}

      {records.length > 0 && (
        <ul className="mb-6 flex flex-col gap-3">
          {records.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-[16px] border border-line p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">{r.role_title}</p>
                <p className="text-[15px] text-ink-muted">{r.organisation}{r.location ? ` · ${r.location}` : ""}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {monthLabel(r.start_date)} – {r.is_current ? "Present" : monthLabel(r.end_date)}
                </p>
                <Badge className="mt-2">{EXPERIENCE_LABELS[r.experience_type]}</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setMessage(null); setEditing(toValues(r)); }}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => {
                    if (!window.confirm("Remove this experience?")) return;
                    startDelete(async () => {
                      const res = await deleteExperience(r.id);
                      setMessage(res.ok ? "Experience removed." : res.error ?? null);
                      router.refresh();
                    });
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ExperienceForm
          key={editing.id || "new"}
          draftKey={`handson:experience-draft:${userId}`}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={(isNew) => {
            setEditing(null);
            setMessage(isNew ? "Experience added." : "Experience updated.");
            router.refresh();
          }}
        />
      ) : records.length === 0 ? (
        <EmptyState title="Add your first experience" action={<Button onClick={() => setEditing({ ...EMPTY })}>Add experience</Button>}>
          No formal job yet? Internships, volunteering, university projects, student associations and family business work all count.
        </EmptyState>
      ) : (
        records.length < 30 && (
          <Button variant="secondary" onClick={() => { setMessage(null); setEditing({ ...EMPTY }); }}>+ Add another experience</Button>
        )
      )}

      <StepFooter
        back="/onboarding/interests"
        note={
          records.length === 0 && !editing ? (
            <p className="text-sm text-ink-muted">You can continue and add this later. Experience counts for 15% of your profile.</p>
          ) : undefined
        }
        onContinue={() => continueFrom(5)}
      />
    </div>
  );
}

function ExperienceForm({
  draftKey,
  initial,
  onCancel,
  onSaved,
}: {
  draftKey: string;
  initial: Values;
  onCancel: () => void;
  onSaved: (isNew: boolean) => void;
}) {
  const isNew = !initial.id;
  const [draft, setDraft, clearDraft] = useLocalDraft<Values>(draftKey, initial);
  const [values, setLocal] = useState<Values>(isNew ? draft : initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const restored = isNew && JSON.stringify(draft) !== JSON.stringify(initial);
  const current = values.isCurrent === "on";
  const thisMonth = new Date().toISOString().slice(0, 7);

  const set = (patch: Values) => {
    const next = { ...values, ...patch };
    setLocal(next);
    if (isNew) setDraft(next);
    setErrors((e) => {
      const copy = { ...e };
      Object.keys(patch).forEach((k) => delete copy[k]);
      return copy;
    });
  };
  const aria = (k: string, hint?: boolean) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": describedBy(k, { hint, error: errors[k] }),
  });

  return (
    <form
      noValidate
      className="rounded-[16px] border-[1.5px] border-indigo/30 bg-indigo-soft/30 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        startSave(async () => {
          setFormError(null);
          const res = await saveExperience(values);
          if (res.ok) {
            if (isNew) clearDraft();
            onSaved(isNew);
          } else {
            setErrors(res.fields ?? {});
            setFormError(res.error ?? "Please fix the highlighted fields.");
          }
        });
      }}
    >
      <h2 className="text-xl">{isNew ? "Add experience" : "Edit experience"}</h2>
      {restored && <p className="mt-1 text-sm text-ink-muted">We restored the details you had started entering.</p>}
      {formError && <Alert tone="danger" className="mt-4">{formError}</Alert>}

      <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
        <Field id="roleTitle" label="Role or title" required error={errors.roleTitle}>
          <Input id="roleTitle" placeholder="e.g. Finance intern" value={values.roleTitle} onChange={(e) => set({ roleTitle: e.target.value })} {...aria("roleTitle")} />
        </Field>
        <Field id="organisation" label="Organisation" required error={errors.organisation}>
          <Input id="organisation" placeholder="Company, NGO, university or association" value={values.organisation} onChange={(e) => set({ organisation: e.target.value })} {...aria("organisation")} />
        </Field>
        <Field id="experienceType" label="Type" required error={errors.experienceType}>
          <Select id="experienceType" value={values.experienceType} onChange={(e) => set({ experienceType: e.target.value })} {...aria("experienceType")}>
            <option value="">Select</option>
            {Object.entries(EXPERIENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field id="location" label="Location" hint="Optional" error={errors.location}>
          <Input id="location" placeholder="e.g. Maputo" value={values.location} onChange={(e) => set({ location: e.target.value })} {...aria("location", true)} />
        </Field>
        <Field id="startMonth" label="Start date" required error={errors.startMonth}>
          <Input id="startMonth" type="month" max={thisMonth} value={values.startMonth} onChange={(e) => set({ startMonth: e.target.value })} {...aria("startMonth")} />
        </Field>
        <div className="flex flex-col gap-3">
          {!current && (
            <Field id="endMonth" label="End date" required error={errors.endMonth}>
              <Input id="endMonth" type="month" value={values.endMonth} onChange={(e) => set({ endMonth: e.target.value })} {...aria("endMonth")} />
            </Field>
          )}
          <Checkbox
            id="isCurrent"
            label="I currently do this"
            checked={current}
            onChange={(e) => set({ isCurrent: e.target.checked ? "on" : "", endMonth: e.target.checked ? "" : values.endMonth })}
            className={current ? "mt-8" : ""}
          />
        </div>
        <Field id="description" label="What you did" hint="Optional. Your main responsibilities." error={errors.description} className="sm:col-span-2">
          <Textarea id="description" maxLength={2000} value={values.description} onChange={(e) => set({ description: e.target.value })} {...aria("description", true)} />
        </Field>
        <Field id="achievements" label="Achievements" hint="Optional. Results you are proud of, ideally with numbers." error={errors.achievements} className="sm:col-span-2">
          <Textarea id="achievements" maxLength={2000} value={values.achievements} onChange={(e) => set({ achievements: e.target.value })} {...aria("achievements", true)} />
        </Field>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => { if (isNew) clearDraft(); onCancel(); }}>Cancel</Button>
        <Button type="submit" loading={saving}>{isNew ? "Save experience" : "Save changes"}</Button>
      </div>
    </form>
  );
}

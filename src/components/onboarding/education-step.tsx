"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { continueFrom, deleteEducation, saveEducation } from "@/app/(app)/onboarding/actions";
import { SearchPicker, StepFooter, useLocalDraft } from "@/components/onboarding/wizard";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, describedBy } from "@/components/ui/field";
import type { Catalogues } from "@/lib/data/catalogues";
import type { EducationRecord } from "@/lib/data/student";
import { ACADEMIC_STATUS_LABELS as STATUS_LABELS, INSTITUTION_TYPE_LABELS as TYPE_LABELS } from "@/lib/onboarding/labels";
import type { FieldErrors } from "@/lib/validation/profile";

type Values = Record<string, string>;

const LANGUAGE_LABELS: Record<string, string> = { pt: "Portuguese", en: "English", fr: "French", other: "Other" };

const EMPTY: Values = {
  id: "", institutionId: "", institutionNameOther: "", institutionType: "", qualificationTypeId: "",
  qualificationName: "", fieldOfStudyId: "", fieldOfStudyOther: "", academicStatus: "", yearOfStudy: "",
  startYear: "", endYear: "", grade: "", gradeScale: "20", languageOfInstruction: "pt",
};

function toValues(r: EducationRecord): Values {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    id: r.id, institutionId: s(r.institution_id), institutionNameOther: s(r.institution_name_other),
    institutionType: r.institution_type, qualificationTypeId: s(r.qualification_type_id),
    qualificationName: s(r.qualification_name), fieldOfStudyId: s(r.field_of_study_id),
    fieldOfStudyOther: s(r.field_of_study_other), academicStatus: r.academic_status, yearOfStudy: s(r.year_of_study),
    startYear: s(r.start_year), endYear: s(r.end_year), grade: s(r.grade), gradeScale: s(r.grade_scale),
    languageOfInstruction: s(r.language_of_instruction),
  };
}

export function EducationStep({
  userId,
  records,
  catalogues,
}: {
  userId: string;
  records: EducationRecord[];
  catalogues: Pick<Catalogues, "institutions" | "qualificationTypes" | "fieldsOfStudy">;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Values | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const institutionName = (r: EducationRecord) =>
    catalogues.institutions.find((i) => i.id === r.institution_id)?.name ?? r.institution_name_other ?? "Institution";
  const qualificationName = (r: EducationRecord) =>
    r.qualification_name || catalogues.qualificationTypes.find((q) => q.id === r.qualification_type_id)?.name || "Qualification";
  const fieldName = (r: EducationRecord) =>
    r.field_of_study_other || catalogues.fieldsOfStudy.find((f) => f.id === r.field_of_study_id)?.name || "";

  return (
    <div>
      {message && <Alert tone="success" className="mb-6">{message}</Alert>}

      {records.length > 0 && (
        <ul className="mb-6 flex flex-col gap-3">
          {records.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-[16px] border border-line p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">{qualificationName(r)}</p>
                <p className="text-[15px] text-ink-muted">
                  {institutionName(r)}
                  {fieldName(r) && ` · ${fieldName(r)}`}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {r.start_year}–{r.end_year ?? "present"}
                  {r.academic_status === "enrolled" && r.end_year ? " (expected)" : ""} · {STATUS_LABELS[r.academic_status]}
                </p>
                {r.verification_status === "verified" && <Badge tone="success" className="mt-2">Verified</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setMessage(null); setEditing(toValues(r)); }}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => {
                    if (!window.confirm("Remove this qualification?")) return;
                    startDelete(async () => {
                      const res = await deleteEducation(r.id);
                      setMessage(res.ok ? "Qualification removed." : res.error ?? null);
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
        <EducationForm
          key={editing.id || "new"}
          draftKey={`handson:education-draft:${userId}`}
          initial={editing}
          catalogues={catalogues}
          onCancel={() => setEditing(null)}
          onSaved={(isNew) => {
            setEditing(null);
            setMessage(isNew ? "Qualification added." : "Qualification updated.");
            router.refresh();
          }}
        />
      ) : records.length === 0 ? (
        <EmptyState
          title="Add your first qualification"
          action={<Button onClick={() => setEditing({ ...EMPTY })}>Add qualification</Button>}
        >
          Your current course or your most recent qualification. University, polytechnic, TVET and secondary education all count.
        </EmptyState>
      ) : (
        records.length < 10 && (
          <Button variant="secondary" onClick={() => { setMessage(null); setEditing({ ...EMPTY }); }}>
            + Add another qualification
          </Button>
        )
      )}

      <StepFooter
        back="/onboarding/personal"
        note={
          records.length === 0 && !editing ? (
            <p className="text-sm text-ink-muted">You can continue and add this later. Education counts for 20% of your profile.</p>
          ) : undefined
        }
        onContinue={() => continueFrom(2)}
      />
    </div>
  );
}

function EducationForm({
  draftKey,
  initial,
  catalogues,
  onCancel,
  onSaved,
}: {
  draftKey: string;
  initial: Values;
  catalogues: Pick<Catalogues, "institutions" | "qualificationTypes" | "fieldsOfStudy">;
  onCancel: () => void;
  onSaved: (isNew: boolean) => void;
}) {
  const isNew = !initial.id;
  // Only new entries use a local draft; edits start from the saved record.
  const [draft, setDraft, clearDraft] = useLocalDraft<Values>(draftKey, initial);
  const [values, setLocal] = useState<Values>(isNew ? draft : initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const restored = isNew && JSON.stringify(draft) !== JSON.stringify(initial);

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

  const selectedInstitution = catalogues.institutions.find((i) => i.id === values.institutionId);
  const qualifications = catalogues.qualificationTypes.filter(
    (q) => !values.institutionType || q.institutionTypes.includes(values.institutionType),
  );
  const otherField = catalogues.fieldsOfStudy.find((f) => f.code === "other");
  const enrolled = values.academicStatus === "enrolled";

  const err = (k: string) => errors[k];
  const aria = (k: string, hint?: boolean) => ({
    "aria-invalid": err(k) ? true : undefined,
    "aria-describedby": describedBy(k, { hint, error: err(k) }),
  });

  return (
    <form
      noValidate
      className="rounded-[16px] border-[1.5px] border-indigo/30 bg-indigo-soft/30 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        startSave(async () => {
          setFormError(null);
          const res = await saveEducation(values);
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
      <h2 className="text-xl">{isNew ? "Add a qualification" : "Edit qualification"}</h2>
      {restored && <p className="mt-1 text-sm text-ink-muted">We restored the details you had started entering.</p>}
      {formError && <Alert tone="danger" className="mt-4">{formError}</Alert>}

      <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
        <Field id="institutionId" label="Institution" required error={err("institutionId")} className="sm:col-span-2"
          hint="Start typing. If your institution is not listed, choose “Use” to enter its name.">
          {selectedInstitution || values.institutionNameOther ? (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border-[1.5px] border-line-strong bg-surface-raised px-3.5 py-2.5">
              <span>
                <span className="block font-medium">{selectedInstitution?.name ?? values.institutionNameOther}</span>
                {selectedInstitution?.province && <span className="text-sm text-ink-muted">{selectedInstitution.province}</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => set({ institutionId: "", institutionNameOther: "" })}>
                Change
              </Button>
            </div>
          ) : (
            <SearchPicker
              id="institutionId"
              placeholder="e.g. Universidade Eduardo Mondlane, UEM, ISCTEM…"
              items={catalogues.institutions.map((i) => ({
                id: i.id,
                label: i.name,
                detail: [i.shortName, TYPE_LABELS[i.type], i.province].filter(Boolean).join(" · "),
                keywords: i.shortName ?? "",
              }))}
              onSelect={(item) => {
                const inst = catalogues.institutions.find((i) => i.id === item.id);
                set({ institutionId: item.id, institutionNameOther: "", institutionType: inst?.type ?? values.institutionType, qualificationTypeId: "" });
              }}
              onCreate={(name) => set({ institutionId: "", institutionNameOther: name })}
              createLabel="Use"
              invalid={!!err("institutionId")}
              describedBy={describedBy("institutionId", { hint: true, error: err("institutionId") })}
            />
          )}
        </Field>

        <Field id="institutionType" label="Type of institution" required error={err("institutionType")}>
          <Select id="institutionType" value={values.institutionType} onChange={(e) => set({ institutionType: e.target.value, qualificationTypeId: "" })} {...aria("institutionType")}>
            <option value="">Select</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>

        <Field id="qualificationTypeId" label="Qualification" required error={err("qualificationTypeId")}>
          <Select id="qualificationTypeId" value={values.qualificationTypeId} onChange={(e) => set({ qualificationTypeId: e.target.value })} {...aria("qualificationTypeId")}>
            <option value="">Select</option>
            {qualifications.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </Select>
        </Field>

        <Field id="fieldOfStudyId" label="Field of study" required error={err("fieldOfStudyId")}>
          <Select id="fieldOfStudyId" value={values.fieldOfStudyId} onChange={(e) => set({ fieldOfStudyId: e.target.value })} {...aria("fieldOfStudyId")}>
            <option value="">Select</option>
            {catalogues.fieldsOfStudy.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Field>

        <Field id="qualificationName" label="Course name" hint="As written on your certificate, e.g. Licenciatura em Contabilidade e Auditoria. Optional." error={err("qualificationName")}>
          <Input id="qualificationName" value={values.qualificationName} onChange={(e) => set({ qualificationName: e.target.value })} {...aria("qualificationName", true)} />
        </Field>

        {values.fieldOfStudyId && String(otherField?.id) === values.fieldOfStudyId && (
          <Field id="fieldOfStudyOther" label="Your field of study" required error={err("fieldOfStudyOther")} className="sm:col-span-2">
            <Input id="fieldOfStudyOther" value={values.fieldOfStudyOther} onChange={(e) => set({ fieldOfStudyOther: e.target.value })} {...aria("fieldOfStudyOther")} />
          </Field>
        )}

        <Field id="academicStatus" label="Status" required error={err("academicStatus")}>
          <Select id="academicStatus" value={values.academicStatus} onChange={(e) => set({ academicStatus: e.target.value })} {...aria("academicStatus")}>
            <option value="">Select</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>

        {enrolled && (
          <Field id="yearOfStudy" label="Current year of study" error={err("yearOfStudy")}>
            <Select id="yearOfStudy" value={values.yearOfStudy} onChange={(e) => set({ yearOfStudy: e.target.value })} {...aria("yearOfStudy")}>
              <option value="">Select</option>
              {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </Select>
          </Field>
        )}

        <Field id="startYear" label="Start year" required error={err("startYear")}>
          <Input id="startYear" inputMode="numeric" placeholder="2022" maxLength={4} value={values.startYear} onChange={(e) => set({ startYear: e.target.value })} {...aria("startYear")} />
        </Field>

        <Field id="endYear" label={enrolled ? "Expected graduation year" : "Graduation or end year"} required={enrolled || values.academicStatus === "graduated"} error={err("endYear")}>
          <Input id="endYear" inputMode="numeric" placeholder="2026" maxLength={4} value={values.endYear} onChange={(e) => set({ endYear: e.target.value })} {...aria("endYear")} />
        </Field>

        <Field id="grade" label="Average grade" hint="Optional. In Mozambique grades are usually out of 20." error={err("grade")}>
          <div className="flex gap-2">
            <Input id="grade" inputMode="decimal" placeholder="14.5" value={values.grade} onChange={(e) => set({ grade: e.target.value.replace(",", ".") })} {...aria("grade", true)} />
            <Select aria-label="Grade scale" className="w-[96px] shrink-0" value={values.gradeScale} onChange={(e) => set({ gradeScale: e.target.value })}>
              {[20, 10, 100, 5, 4].map((s) => <option key={s} value={s}>/ {s}</option>)}
            </Select>
          </div>
        </Field>

        <Field id="languageOfInstruction" label="Language of instruction" error={err("languageOfInstruction")}>
          <Select id="languageOfInstruction" value={values.languageOfInstruction} onChange={(e) => set({ languageOfInstruction: e.target.value })}>
            <option value="">Select</option>
            {Object.entries(LANGUAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => { if (isNew) clearDraft(); onCancel(); }}>Cancel</Button>
        <Button type="submit" loading={saving}>{isNew ? "Save qualification" : "Save changes"}</Button>
      </div>
    </form>
  );
}

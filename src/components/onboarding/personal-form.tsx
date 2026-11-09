"use client";

import { useState } from "react";
import { savePersonal } from "@/app/(app)/onboarding/actions";
import { StepFooter, useAutosave } from "@/components/onboarding/wizard";
import { Field, Input, Select, describedBy } from "@/components/ui/field";
import { DIAL_CODES } from "@/lib/countries";
import type { FieldErrors } from "@/lib/validation/profile";

type Values = Record<string, string>;
type CountryOption = { code: string; name: string };

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function PersonalForm({
  initial,
  countries,
  provinces,
}: {
  initial: Values;
  countries: { priority: CountryOption[]; rest: CountryOption[] };
  provinces: { id: number; name: string }[];
}) {
  const [values, setValues] = useState<Values>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const autosave = useAutosave((v: Values) => savePersonal(v, "draft"));

  const set = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setFields((f) => ({ ...f, [key]: undefined }));
    autosave.schedule(next);
  };

  // Show format errors from the latest autosave.
  const errors: FieldErrors = { ...(autosave.result?.ok === false ? autosave.result.fields : {}), ...fields };

  const text = (id: string, label: string, opts: { required?: boolean; type?: string; autoComplete?: string; hint?: string; placeholder?: string } = {}) => (
    <Field id={id} label={label} required={opts.required} hint={opts.hint} error={errors[id]}>
      <Input
        id={id}
        name={id}
        type={opts.type ?? "text"}
        autoComplete={opts.autoComplete}
        placeholder={opts.placeholder}
        value={values[id] ?? ""}
        onChange={(e) => set(id, e.target.value)}
        onBlur={() => autosave.flush()}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={describedBy(id, { hint: opts.hint, error: errors[id] })}
      />
    </Field>
  );

  const countrySelect = (id: string, label: string) => (
    <Field id={id} label={label} required error={errors[id]}>
      <Select
        id={id}
        value={values[id] ?? ""}
        onChange={(e) => set(id, e.target.value)}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={describedBy(id, { error: errors[id] })}
      >
        <option value="">Select a country</option>
        {countries.priority.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
        <option disabled>──────────</option>
        {countries.rest.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </Select>
    </Field>
  );

  const inMozambique = (values.country || "MZ") === "MZ";

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-3">
        {text("firstName", "First name", { required: true, autoComplete: "given-name" })}
        {text("middleName", "Middle name", { autoComplete: "additional-name" })}
        {text("surname", "Surname", { required: true, autoComplete: "family-name" })}

        {text("dateOfBirth", "Date of birth", { required: true, type: "date", autoComplete: "bday" })}
        <Field id="gender" label="Gender" hint="Optional" error={errors.gender}>
          <Select id="gender" value={values.gender ?? ""} onChange={(e) => set("gender", e.target.value)} aria-describedby="gender-hint">
            <option value="">Select</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
        </Field>
        {countrySelect("nationality", "Nationality")}
      </div>

      <h2 className="mb-5 mt-10 text-xl">Where you live</h2>
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-3">
        {countrySelect("country", "Country")}
        {inMozambique && (
          <Field id="provinceId" label="Province" required error={errors.provinceId}>
            <Select
              id="provinceId"
              value={values.provinceId ?? ""}
              onChange={(e) => set("provinceId", e.target.value)}
              aria-invalid={errors.provinceId ? true : undefined}
              aria-describedby={describedBy("provinceId", { error: errors.provinceId })}
            >
              <option value="">Select a province</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
        )}
        {text("city", "City or district", { required: true, autoComplete: "address-level2" })}
      </div>

      <h2 className="mb-5 mt-10 text-xl">Contact and online profile</h2>
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
        <Field
          id="phoneNumber"
          label="Phone number"
          required
          hint="Mozambican mobile numbers have 9 digits, for example 84 123 4567."
          error={errors.phoneNumber}
        >
          <div className="flex gap-2">
            <Select
              aria-label="Country dialling code"
              className="w-[104px] shrink-0"
              value={values.phoneDial || "+258"}
              onChange={(e) => set("phoneDial", e.target.value)}
            >
              {DIAL_CODES.map((d) => (
                <option key={d.code} value={d.code}>{d.code}</option>
              ))}
            </Select>
            <Input
              id="phoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="84 123 4567"
              value={values.phoneNumber ?? ""}
              onChange={(e) => set("phoneNumber", e.target.value)}
              onBlur={() => autosave.flush()}
              aria-invalid={errors.phoneNumber ? true : undefined}
              aria-describedby={describedBy("phoneNumber", { hint: true, error: errors.phoneNumber })}
            />
          </div>
        </Field>
        {text("linkedinUrl", "LinkedIn profile", { type: "url", placeholder: "linkedin.com/in/your-name", hint: "Optional" })}
      </div>

      <div className="mt-8 rounded-[14px] bg-surface px-4 py-3.5 text-[15px] text-ink-muted">
        <strong className="text-ink">Profile photo:</strong> you will be able to add a photo once secure file uploads open,
        together with your CV and certificates.
      </div>

      <StepFooter
        back={null}
        status={autosave.status}
        onContinue={async () => {
          await autosave.flush();
          const r = await savePersonal(values, "continue");
          if (!r.ok) setFields(r.fields ?? {});
          return r;
        }}
      />
    </form>
  );
}

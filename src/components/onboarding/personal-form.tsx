"use client";

import { cn } from "@/lib/cn";
import { useState, type ReactNode } from "react";
import { savePersonal } from "@/app/(app)/onboarding/actions";
import { DateOfBirthField } from "@/components/onboarding/date-of-birth";
import { EmbeddedSave, StepFooter, useAutosave } from "@/components/onboarding/wizard";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { DIAL_CODES } from "@/lib/countries";
import { HEADLINE_MAX, SUMMARY_MAX, type FieldErrors } from "@/lib/validation/profile";
import { T, useT } from "@/i18n/client";

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
  districts,
  photo,
  embedded = false,
}: {
  embedded?: boolean;
  photo: ReactNode;
  initial: Values;
  countries: { priority: CountryOption[]; rest: CountryOption[] };
  provinces: { id: number; name: string }[];
  districts: { id: number; provinceId: number; name: string }[];
}) {
  const t = useT();
  const [values, setValues] = useState<Values>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const autosave = useAutosave((v: Values) => savePersonal(v, "draft"));

  const set = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    // A district belongs to one province: choosing another province clears it.
    if (key === "provinceId" && value !== values.provinceId) next.districtId = "";
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
        placeholder={opts.placeholder && t(opts.placeholder)}
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
        <option value="">{t("Select a country")}</option>
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
  const provinceDistricts = districts.filter((d) => String(d.provinceId) === values.provinceId);

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()}>
      <div className="mb-8">{photo}</div>
      <div className={cn("grid gap-x-5 gap-y-6", embedded ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {text("firstName", "First name", { required: true, autoComplete: "given-name" })}
        {embedded && text("middleName", "Middle name", { autoComplete: "additional-name" })}
        {text("surname", "Surname", { required: true, autoComplete: "family-name" })}

        <DateOfBirthField className={embedded ? "sm:col-span-2" : undefined} value={values.dateOfBirth} error={errors.dateOfBirth} onChange={(iso) => set("dateOfBirth", iso)} />
        {countrySelect("nationality", "Nationality")}
        {embedded && (
        <Field id="gender" label="Gender" hint="Optional" error={errors.gender}>
          <Select id="gender" value={values.gender ?? ""} onChange={(e) => set("gender", e.target.value)} aria-describedby="gender-hint">
            <option value="">{t("Select")}</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{t(g.label)}</option>
            ))}
          </Select>
        </Field>
        )}
      </div>

      <h2 className="mb-5 mt-10 text-xl"><T>{"Where you live"}</T></h2>
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
              <option value="">{t("Select a province")}</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
        )}
        {inMozambique && (
          <Field id="districtId" label="District" required error={errors.districtId}>
            <Select
              id="districtId"
              value={values.districtId ?? ""}
              disabled={!values.provinceId}
              onChange={(e) => set("districtId", e.target.value)}
              aria-invalid={errors.districtId ? true : undefined}
              aria-describedby={describedBy("districtId", { error: errors.districtId })}
            >
              <option value="">{values.provinceId ? t("Select a district") : t("Select a province first")}</option>
              {provinceDistricts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
              <option value="other">{t("Not listed — type your city")}</option>
            </Select>
          </Field>
        )}
        {(!inMozambique || values.districtId === "other") &&
          text("city", "City or town", { required: true, autoComplete: "address-level2" })}
      </div>

      <h2 className="mb-2 mt-10 text-xl"><T>{"How you introduce yourself"}</T></h2>
      <p className="mb-5 max-w-2xl text-[15px] text-ink-muted">
        <T>{"Employers read this first. Keep it factual: what you study or do, and what you are looking for. Do not paste a cover letter or your contact details here."}</T>
      </p>
      <div className="grid gap-y-6">
        <Field
          id="headline"
          label="Professional headline"
          required
          hint={`${t("For example: “Finalista de Contabilidade e Auditoria à procura de estágio”")} · ${(values.headline ?? "").length}/${HEADLINE_MAX}`}
          error={errors.headline}
        >
          <Input
            id="headline"
            maxLength={HEADLINE_MAX}
            value={values.headline ?? ""}
            onChange={(e) => set("headline", e.target.value)}
            onBlur={() => autosave.flush()}
            aria-invalid={errors.headline ? true : undefined}
            aria-describedby={describedBy("headline", { hint: true, error: errors.headline })}
          />
        </Field>
        {embedded && (
        <Field
          id="summary"
          label="Short summary"
          hint={`${t("Optional. Two or three sentences on your strengths and the kind of role you want")} · ${(values.summary ?? "").length}/${SUMMARY_MAX}`}
          error={errors.summary}
        >
          <Textarea
            id="summary"
            rows={4}
            maxLength={SUMMARY_MAX}
            value={values.summary ?? ""}
            onChange={(e) => set("summary", e.target.value)}
            onBlur={() => autosave.flush()}
            aria-invalid={errors.summary ? true : undefined}
            aria-describedby={describedBy("summary", { hint: true, error: errors.summary })}
          />
        </Field>
        )}
      </div>

      <h2 className="mb-5 mt-10 text-xl"><T>{embedded ? "Contact and online profile" : "Contact"}</T></h2>
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
              aria-label={t("Country dialling code")}
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
        {embedded && text("linkedinUrl", "LinkedIn profile", { type: "url", placeholder: "linkedin.com/in/your-name", hint: "Optional" })}
      </div>

      {embedded ? (

        <EmbeddedSave
    status={autosave.status}
    onSave={async () => {
      await autosave.flush();
      const r = await savePersonal(values, "continue");
      setFields(r.ok ? {} : r.fields ?? {});
      return r.ok;
    }}
  />

      ) : (
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

      )}
    </form>
  );
}

"use client";

import { useState } from "react";
import { Field, Select, describedBy } from "@/components/ui/field";
import { LOCALE_TAGS } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";

/** Oldest and youngest years offered; validation still decides what is accepted. */
const YOUNGEST = 14;
const OLDEST = 70;

const pad = (n: string) => n.padStart(2, "0");

/** "2001-03-07" → ["2001", "3", "7"]; anything else → empty parts. */
function split(iso: string | undefined): [string, string, string] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? [m[1], String(Number(m[2])), String(Number(m[3]))] : ["", "", ""];
}

/**
 * Date of birth as day, month and year lists. Avoids the browser date picker,
 * which shows month/day/year (US order) on many devices.
 * Calls onChange with "YYYY-MM-DD" once all three are chosen, "" when cleared.
 */
export function DateOfBirthField({ value, error, onChange }: { value: string | undefined; error?: string; onChange: (iso: string) => void }) {
  const t = useT();
  const locale = useLocale();
  const [initialYear, initialMonth, initialDay] = split(value);
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: OLDEST - YOUNGEST + 1 }, (_, i) => String(thisYear - YOUNGEST - i));
  const monthName = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: "long", timeZone: "UTC" });
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName.format(new Date(Date.UTC(2000, i, 1))) }));
  const daysInMonth = year && month ? new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate() : 31;

  const update = (next: { day?: string; month?: string; year?: string }) => {
    const d = next.day ?? day;
    const m = next.month ?? month;
    const y = next.year ?? year;
    // Keep the day valid when the month or year changes (e.g. 31 → February).
    const max = y && m ? new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate() : 31;
    const safeDay = d && Number(d) > max ? String(max) : d;
    setDay(safeDay);
    setMonth(m);
    setYear(y);
    if (safeDay && m && y) onChange(`${y}-${pad(m)}-${pad(safeDay)}`);
    else if (!safeDay && !m && !y) onChange("");
  };

  const describe = describedBy("dateOfBirth", { error });
  const invalid = error ? true : undefined;

  return (
    <Field id="dateOfBirth" label="Date of birth" required error={error} className="sm:col-span-2">
      <div className="grid grid-cols-[minmax(72px,0.8fr)_minmax(120px,1.5fr)_minmax(88px,1fr)] gap-2" role="group" aria-describedby={describe}>
        <Select id="dateOfBirth" className="pr-8" aria-label={t("Day")} value={day} aria-invalid={invalid} onChange={(e) => update({ day: e.target.value })}>
          <option value="">{t("Day")}</option>
          {Array.from({ length: daysInMonth }, (_, i) => String(i + 1)).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Select className="pr-8" aria-label={t("Month")} value={month} aria-invalid={invalid} onChange={(e) => update({ month: e.target.value })}>
          <option value="">{t("Month")}</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>
        <Select className="pr-8" aria-label={t("Year")} value={year} aria-invalid={invalid} onChange={(e) => update({ year: e.target.value })}>
          <option value="">{t("Year")}</option>
          {year && !years.includes(year) && <option value={year}>{year}</option>}
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>
    </Field>
  );
}

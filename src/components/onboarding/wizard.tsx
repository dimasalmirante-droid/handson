"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { SaveResult } from "@/app/(app)/onboarding/actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { STEPS } from "@/lib/onboarding/steps";

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

export function WizardStepper({ completeSteps }: { completeSteps: number[] }) {
  const pathname = usePathname();
  const items = [...STEPS.map((s) => ({ ...s, href: `/onboarding/${s.slug}` })), { slug: "review", number: 7, label: "Review", href: "/onboarding/review" }];

  return (
    <nav aria-label="Profile steps" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
        {items.map((s) => {
          const current = pathname === s.href;
          const complete = completeSteps.includes(s.number);
          return (
            <li key={s.slug}>
              <Link
                href={s.href}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-pill)] py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-colors",
                  current ? "bg-ink text-white" : "bg-surface-raised text-ink ring-1 ring-inset ring-line hover:ring-line-strong",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    current ? "bg-lime text-ink" : complete ? "bg-indigo text-white" : "bg-surface text-ink-muted ring-1 ring-inset ring-line-strong",
                  )}
                >
                  {complete && !current ? "✓" : s.number}
                </span>
                {s.label}
                <span className="sr-only">{complete ? " (complete)" : ""}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Autosave                                                            */
/* ------------------------------------------------------------------ */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Call `schedule(values)` on every change; the latest
 * values are saved after `delay` ms of inactivity. `flush()` saves now.
 */
export function useAutosave<T>(save: (values: T) => Promise<SaveResult>, delay = 900) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [result, setResult] = useState<SaveResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<T | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const run = useCallback(async () => {
    if (latest.current === null) return null;
    const values = latest.current;
    latest.current = null;
    setStatus("saving");
    try {
      const r = await saveRef.current(values);
      setResult(r);
      setStatus(r.ok ? "saved" : "error");
      return r;
    } catch {
      const r = { ok: false, error: "Connection problem. Your latest changes are not saved yet." };
      setResult(r);
      setStatus("error");
      return r;
    }
  }, []);

  const schedule = useCallback(
    (values: T) => {
      latest.current = values;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, delay);
    },
    [delay, run],
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return run();
  }, [run]);

  // Save pending changes when the page is hidden or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && latest.current !== null) void run();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  return { status, result, schedule, flush };
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const text = {
    idle: "Changes save automatically",
    saving: "Saving…",
    saved: "All changes saved",
    error: "Not saved — check the highlighted fields",
  }[status];
  return (
    <p role="status" aria-live="polite" className={cn("text-sm", status === "error" ? "font-medium text-danger" : "text-ink-muted")}>
      {status === "saved" && <span aria-hidden className="mr-1 text-success">✓</span>}
      {text}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Step frame and footer                                               */
/* ------------------------------------------------------------------ */

export function StepHeader({ step, title, lead }: { step: number; title: string; lead: ReactNode }) {
  return (
    <header className="mb-8">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-indigo">Step {step} of 6</p>
      <h1 className="mt-2 text-[clamp(28px,4vw,38px)] tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">{lead}</p>
    </header>
  );
}

/**
 * Back / Continue bar. `onContinue` saves and returns the next path; the
 * footer then navigates. Errors stay on the page.
 */
export function StepFooter({
  back,
  onContinue,
  continueLabel = "Save and continue",
  status,
  note,
}: {
  back: string | null;
  onContinue: () => Promise<SaveResult | null>;
  continueLabel?: string;
  status?: SaveStatus;
  note?: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-10 border-t border-line pt-6">
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {note && <div className="mb-4">{note}</div>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {back ? (
            <Link href={back} className={buttonClasses({ variant: "ghost" })}>
              ← Back
            </Link>
          ) : (
            <span />
          )}
          {status && <SaveIndicator status={status} />}
        </div>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await onContinue();
              if (r?.ok && r.next) router.push(r.next);
              else if (r && !r.ok) setError(r.error ?? "Please fix the highlighted fields before continuing.");
            })
          }
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

/** Save bar for forms shown on the dashboard: autosave status plus an explicit check. */
export function EmbeddedSave({ status, onSave }: { status: SaveStatus; onSave: () => Promise<boolean> }) {
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState<"ok" | "error" | null>(null);
  return (
    <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div aria-live="polite">
        {checked === "error" ? (
          <p className="text-sm font-medium text-danger">Some required fields need attention.</p>
        ) : checked === "ok" ? (
          <p className="text-sm text-ink-muted"><span aria-hidden className="mr-1 text-success">✓</span>Saved. All required fields are complete.</p>
        ) : (
          <SaveIndicator status={status} />
        )}
      </div>
      <Button
        loading={pending}
        onClick={() => start(async () => setChecked((await onSave()) ? "ok" : "error"))}
      >
        Save changes
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choice controls                                                     */
/* ------------------------------------------------------------------ */

type ChipOption<V> = { value: V; label: string };

/** Multi-select as toggle chips (checkbox semantics). */
export function ChipGroup<V extends string | number>({
  legend,
  options,
  selected,
  onChange,
  max,
  required,
  hint,
}: {
  legend: string;
  options: ChipOption<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
  max?: number;
  required?: boolean;
  hint?: string;
}) {
  const atMax = max !== undefined && selected.length >= max;
  return (
    <fieldset>
      <legend className="text-sm font-semibold">
        {legend}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </legend>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label
              key={String(o.value)}
              className={cn(
                "cursor-pointer select-none rounded-[var(--radius-pill)] px-4 py-2 text-[15px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo",
                on ? "bg-indigo text-white" : "bg-surface-raised text-ink ring-1 ring-inset ring-line-strong hover:bg-indigo-soft",
                !on && atMax && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={!on && atMax}
                onChange={() => onChange(on ? selected.filter((s) => s !== o.value) : [...selected, o.value])}
              />
              {on && <span aria-hidden className="mr-1">✓</span>}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Single choice as cards (radio semantics). */
export function RadioCards<V extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  required,
}: {
  legend: string;
  name: string;
  options: ChipOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">
        {legend}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-3 text-[15px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo",
              value === o.value ? "border-indigo bg-indigo-soft font-semibold" : "border-line bg-surface-raised hover:border-line-strong",
            )}
          >
            <input type="radio" name={name} className="size-4 accent-indigo" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Searchable picker                                                   */
/* ------------------------------------------------------------------ */

export type PickerItem = { id: string; label: string; detail?: string; keywords?: string };

/**
 * Accessible combobox: type to filter, arrow keys to move, Enter to choose.
 * `onCreate` (optional) offers "Use “…”" for entries not in the list.
 */
export function SearchPicker({
  id,
  items,
  placeholder,
  onSelect,
  onCreate,
  createLabel = "Add",
  invalid,
  describedBy,
  initialQuery = "",
}: {
  id: string;
  items: PickerItem[];
  placeholder: string;
  onSelect: (item: PickerItem) => void;
  onCreate?: (text: string) => void;
  createLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = norm(query.trim());
  const matches = q
    ? items.filter((i) => norm(`${i.label} ${i.detail ?? ""} ${i.keywords ?? ""}`).includes(q)).slice(0, 8)
    : items.slice(0, 8);
  const canCreate = !!onCreate && query.trim().length >= 2 && !items.some((i) => norm(i.label) === q);
  const total = matches.length + (canCreate ? 1 : 0);

  const choose = (index: number) => {
    if (index < matches.length) {
      onSelect(matches[index]);
      setQuery("");
    } else if (canCreate) {
      onCreate!(query.trim());
      setQuery("");
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open && total > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && total > 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, total - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && total > 0) {
            e.preventDefault();
            choose(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="block h-12 w-full rounded-[var(--radius-sm)] border-[1.5px] border-line-strong bg-surface-raised px-3.5 text-base placeholder:text-ink-muted/70 focus:border-indigo focus:outline-none focus:ring-[3px] focus:ring-indigo/20 aria-[invalid=true]:border-danger"
      />
      {open && total > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[14px] border border-line bg-surface-raised p-1.5 shadow-[0_18px_40px_rgba(22,19,31,0.12)]"
        >
          {matches.map((m, i) => (
            <li
              key={m.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-[8px] px-3 py-2", i === active && "bg-indigo-soft")}
            >
              <span className="block text-[15px] font-medium">{m.label}</span>
              {m.detail && <span className="block text-sm text-ink-muted">{m.detail}</span>}
            </li>
          ))}
          {canCreate && (
            <li
              id={`${id}-opt-${matches.length}`}
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(matches.length);
              }}
              onMouseEnter={() => setActive(matches.length)}
              className={cn("cursor-pointer rounded-[8px] px-3 py-2 text-[15px]", active === matches.length && "bg-indigo-soft")}
            >
              {createLabel} “<strong>{query.trim()}</strong>”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Local drafts for unsaved entry forms                                */
/* ------------------------------------------------------------------ */

/** Keeps an in-progress form in localStorage so it survives navigation. */
export function useLocalDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep in memory only */
      }
    },
    [key],
  );

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return [value, update, clear] as const;
}

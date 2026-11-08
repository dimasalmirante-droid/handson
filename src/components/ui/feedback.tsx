import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ---------- Card ---------- */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[var(--radius-lg)] border border-line bg-surface-raised p-6 sm:p-8", className)}
      {...props}
    />
  );
}

/* ---------- Badge ---------- */

type Tone = "neutral" | "indigo" | "lime" | "success" | "warning" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-surface text-ink-muted ring-1 ring-inset ring-line",
  indigo: "bg-indigo-soft text-indigo",
  lime: "bg-lime text-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-[13px] font-semibold leading-4",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Progress ---------- */

type ProgressProps = { value: number; label: string; showValue?: boolean; className?: string };

/** Accessible progress bar; `value` is clamped to 0–100. */
export function Progress({ value, label, showValue = true, className }: ProgressProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-baseline justify-between text-sm font-semibold">
        <span>{label}</span>
        {showValue && <span className="tabular-nums">{v}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 overflow-hidden rounded-[var(--radius-pill)] bg-indigo-soft"
      >
        <div className="h-full rounded-[var(--radius-pill)] bg-indigo transition-[width]" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

/* ---------- Alert ---------- */

type AlertTone = "info" | "success" | "warning" | "danger";

const alertTones: Record<AlertTone, { box: string; icon: string; symbol: string }> = {
  info: { box: "bg-indigo-soft text-ink", icon: "bg-indigo text-white", symbol: "i" },
  success: { box: "bg-success-soft text-ink", icon: "bg-success text-white", symbol: "✓" },
  warning: { box: "bg-warning-soft text-ink", icon: "bg-warning text-white", symbol: "!" },
  danger: { box: "bg-danger-soft text-ink", icon: "bg-danger text-white", symbol: "!" },
};

type AlertProps = { tone?: AlertTone; title?: ReactNode; children?: ReactNode; className?: string };

/** Inline message. Status is conveyed by icon and title, not colour alone. */
export function Alert({ tone = "info", title, children, className }: AlertProps) {
  const t = alertTones[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-[14px] px-4 py-3.5 text-[15px] leading-6", t.box, className)}
    >
      <span
        aria-hidden
        className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold", t.icon)}
      >
        {t.symbol}
      </span>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 text-ink-muted")}>{children}</div>}
      </div>
    </div>
  );
}

/* ---------- Stepper (onboarding progress) ---------- */

type Step = { label: string; status: "complete" | "current" | "upcoming" };

export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex flex-wrap gap-x-6 gap-y-3", className)}>
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2.5 text-sm" aria-current={s.status === "current" ? "step" : undefined}>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
              s.status === "complete" && "bg-indigo text-white",
              s.status === "current" && "bg-lime text-ink ring-4 ring-lime/40",
              s.status === "upcoming" && "border-[1.5px] border-line-strong text-ink-muted",
            )}
          >
            {s.status === "complete" ? "✓" : i + 1}
          </span>
          <span className={cn("font-medium", s.status === "upcoming" ? "text-ink-muted" : "text-ink")}>
            {s.label}
            <span className="sr-only">
              {s.status === "complete" ? " (complete)" : s.status === "current" ? " (current step)" : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface-raised px-6 py-12 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <div className="mt-2 max-w-md text-ink-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

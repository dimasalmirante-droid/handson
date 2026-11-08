import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-[var(--radius-sm)] border-[1.5px] border-line-strong bg-surface-raised px-3.5 text-base text-ink " +
  "placeholder:text-ink-muted/70 transition-shadow " +
  "focus:border-indigo focus:outline-none focus:ring-[3px] focus:ring-indigo/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-32 py-3", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-12 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%235B5766' stroke-width='2'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  );
}

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { label: ReactNode };

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 text-[15px] leading-6", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-[5px] border-[1.5px] border-line-strong accent-indigo"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

type FieldProps = {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Label, control, hint and error message in one block.
 * The control inside must use the same `id`, plus
 * `aria-describedby={describedBy(id, …)}` and `aria-invalid` when `error` is set.
 */
export function Field({ id, label, required, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Build the aria-describedby value matching `Field`'s hint/error ids. */
export function describedBy(id: string, { hint, error }: { hint?: unknown; error?: unknown }) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

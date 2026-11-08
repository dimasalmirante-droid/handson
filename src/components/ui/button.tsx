import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "accent" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-semibold whitespace-nowrap transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-indigo text-on-indigo hover:bg-indigo-dark",
  secondary: "bg-transparent text-ink ring-2 ring-inset ring-ink hover:bg-ink hover:text-white",
  accent: "bg-lime text-ink hover:bg-[#c6e64a]",
  ghost: "bg-transparent text-ink hover:bg-indigo-soft hover:text-indigo",
  danger: "bg-danger text-white hover:bg-[#931c13]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-12 px-6 text-base",
  lg: "h-14 px-8 text-[17px]",
};

type StyleProps = { variant?: Variant; size?: Size; fullWidth?: boolean };

export function buttonClasses({ variant = "primary", size = "md", fullWidth }: StyleProps = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full");
}

type ButtonProps = ComponentProps<"button"> & StyleProps & { loading?: boolean };

/** Primary action control. Use `ButtonLink` for navigation. */
export function Button({
  variant,
  size,
  fullWidth,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A link styled as a button. */
export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonClasses({ variant, size, fullWidth }), className)} {...props} />;
}

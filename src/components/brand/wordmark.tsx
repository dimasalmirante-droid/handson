import Link from "next/link";
import { cn } from "@/lib/cn";

/** Text wordmark used until a logo is designed. */
export function Wordmark({ href = "/", inverse, className }: { href?: string; inverse?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="Handson home"
      className={cn(
        "font-display text-[28px] font-bold leading-none tracking-[-0.04em] no-underline",
        inverse ? "text-white" : "text-ink",
        className,
      )}
    >
      handson<span className={inverse ? "text-lime" : "text-indigo"}>.</span>
    </Link>
  );
}

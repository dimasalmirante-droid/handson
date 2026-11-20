"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { LOCALE_NAMES, locales } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

/** PT · EN links. The choice is remembered (cookie, and the student's profile when signed in). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const pathname = usePathname();
  const search = useSearchParams();
  const here = `${pathname}${search.size ? `?${search.toString()}` : ""}`;

  return (
    <nav aria-label={t("Language")} className={cn("flex items-center gap-1 text-sm", className)}>
      {locales.map((l) => (
        <a
          key={l}
          href={`/locale?set=${l}&next=${encodeURIComponent(here)}`}
          lang={l}
          aria-current={l === locale ? "true" : undefined}
          title={LOCALE_NAMES[l]}
          className={cn(
            "rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold uppercase",
            l === locale ? "bg-ink text-white" : "text-ink-muted hover:bg-indigo-soft hover:text-indigo",
          )}
        >
          {l}
        </a>
      ))}
    </nav>
  );
}

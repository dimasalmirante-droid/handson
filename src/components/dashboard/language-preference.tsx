"use client";

import { usePathname } from "next/navigation";
import { LOCALE_NAMES, locales, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

/** Language of the app and of messages from Handson. Saved to the profile. */
export function LanguagePreference({ current }: { current: Locale }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <div>
      <p className="text-[15px] text-ink-muted">{t("The language Handson uses for you. You can change it at any time.")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {locales.map((l) => (
          <a
            key={l}
            href={`/locale?set=${l}&next=${encodeURIComponent(pathname)}`}
            lang={l}
            aria-current={l === current ? "true" : undefined}
            className={cn(
              "rounded-[var(--radius-pill)] px-4 py-2 text-[15px] font-semibold",
              l === current ? "bg-ink text-white" : "bg-surface-raised ring-1 ring-inset ring-line-strong hover:bg-indigo-soft",
            )}
          >
            {LOCALE_NAMES[l]}
          </a>
        ))}
      </div>
    </div>
  );
}

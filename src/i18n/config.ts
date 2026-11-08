/**
 * Locale configuration. English ships first; Portuguese is prepared so it can
 * be enabled by adding `messages/pt.json` and listing it in `locales`.
 * The active locale will come from the user's saved preference (Phase 5),
 * falling back to the default.
 */
export const locales = ["en"] as const;
export const plannedLocales = ["en", "pt"] as const;
export const defaultLocale: Locale = "en";

export type Locale = (typeof locales)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

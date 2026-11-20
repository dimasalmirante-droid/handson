/**
 * Locale configuration. Portuguese is the default; English is available.
 *
 * Texts are written in English in the code and translated through the
 * Portuguese catalogue (`messages/pt.json`, keyed by the English text). A
 * text missing from the catalogue falls back to English; a unit test fails
 * when a marked text has no Portuguese translation.
 */
export const locales = ["pt", "en"] as const;
export const defaultLocale: Locale = "pt";
export const LOCALE_COOKIE = "handson_locale";

export type Locale = (typeof locales)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export const LOCALE_NAMES: Record<Locale, string> = { pt: "Português", en: "English" };

/** BCP 47 tags for dates and numbers. */
export const LOCALE_TAGS: Record<Locale, string> = { pt: "pt-MZ", en: "en-GB" };

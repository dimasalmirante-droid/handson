import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { translator, type TFunction } from "./translate";

/**
 * The visitor's language: their choice (cookie, set from the language switcher
 * or their saved preference), otherwise Portuguese.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
});

export async function getT(): Promise<TFunction> {
  return translator(await getLocale());
}

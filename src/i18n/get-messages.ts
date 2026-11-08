import "server-only";
import { defaultLocale, type Locale } from "./config";
import en from "./messages/en.json";

export type Messages = typeof en;

const loaders: Record<Locale, () => Promise<Messages>> = {
  en: async () => en,
  // pt: () => import("./messages/pt.json").then((m) => m.default),
};

/** Load the message catalogue for a locale (server components only). */
export async function getMessages(locale: Locale = defaultLocale): Promise<Messages> {
  return loaders[locale]();
}

import type { Locale } from "./config";
import pt from "./messages/pt.json";

export type Vars = Record<string, string | number>;
export type TFunction = (text: string, vars?: Vars) => string;

const catalogues: Record<Locale, Record<string, string>> = { pt, en: {} };

type Template = { pattern: RegExp; names: string[]; translation: string };

/** Keys with {placeholders} also match texts that were filled in before translation (e.g. server messages). */
function compileTemplates(catalogue: Record<string, string>): Template[] {
  return Object.entries(catalogue)
    .filter(([key]) => /\{\w+\}/.test(key))
    .map(([key, translation]) => {
      const names: string[] = [];
      const source = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          names.push(m[1]);
          return "(.+?)";
        })
        .join("");
      return { pattern: new RegExp(`^${source}$`, "s"), names, translation };
    });
}

const templates: Record<Locale, Template[]> = { pt: compileTemplates(pt), en: [] };

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** Translate an English text. Unknown texts are returned unchanged (English). */
export function translate(locale: Locale, text: string, vars?: Vars): string {
  const exact = catalogues[locale][text];
  if (exact !== undefined) return interpolate(exact, vars);
  if (!vars) {
    for (const tpl of templates[locale]) {
      const m = tpl.pattern.exec(text);
      if (m) {
        // Filled-in values may themselves be known texts (e.g. a field label).
        const values = tpl.names.map((n, i) => [n, catalogues[locale][m[i + 1]] ?? m[i + 1]]);
        return interpolate(tpl.translation, Object.fromEntries(values));
      }
    }
  }
  return interpolate(text, vars);
}

export function translator(locale: Locale): TFunction {
  return (text, vars) => translate(locale, text, vars);
}

/**
 * Marks a text for translation where it is defined (validation messages,
 * labels) and is translated later where it is shown. Returns it unchanged.
 */
export const msg = (text: string) => text;

type Errors = Partial<Record<string, string>>;

/**
 * Field errors to show: those from the latest automatic save, overlaid with
 * errors from an explicit save. An entry cleared after an edit (undefined) must
 * not hide the automatic-save error for that field, or an invalid value (for
 * example a 3-digit phone number) shows no message at all.
 */
export function mergeFieldErrors(fromAutosave: Errors | undefined, fromSubmit: Errors): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(fromAutosave ?? {})) if (message) out[key] = message;
  for (const [key, message] of Object.entries(fromSubmit)) {
    if (message) out[key] = message;
  }
  return out;
}

/** ISO 3166-1 alpha-2 codes. Names come from Intl.DisplayNames in the user's language. */
export const COUNTRY_CODES = [
  "AF","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BT","BO","BA","BW","BR",
  "BN","BG","BF","BI","CV","KH","CM","CA","CF","TD","CL","CN","CO","KM","CG","CD","CR","CI","HR","CU","CY","CZ","DK","DJ",
  "DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI","FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY",
  "HT","HN","HU","IS","IN","ID","IR","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KW","KG","LA","LV","LB","LS","LR",
  "LY","LI","LT","LU","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM","NA","NR",
  "NP","NL","NZ","NI","NE","NG","KP","MK","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PL","PT","QA","RO","RU","RW",
  "KN","LC","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB","SO","ZA","KR","SS","ES","LK","SD","SR","SE",
  "CH","SY","TW","TJ","TZ","TH","TL","TG","TO","TT","TN","TR","TM","TV","UG","UA","AE","GB","US","UY","UZ","VU","VA","VE",
  "VN","YE","ZM","ZW",
] as const;

/** Countries shown first in pickers: Mozambique and its main partners. */
export const PRIORITY_COUNTRIES = ["MZ", "ZA", "PT", "BR", "AO", "ZW", "MW", "TZ", "ZM", "SZ", "CV"] as const;

export function countryOptions(locale = "en") {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const name = (c: string) => names.of(c) ?? c;
  const priority = PRIORITY_COUNTRIES.map((c) => ({ code: c, name: name(c) }));
  const rest = COUNTRY_CODES.filter((c) => !(PRIORITY_COUNTRIES as readonly string[]).includes(c))
    .map((c) => ({ code: c, name: name(c) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return { priority, rest };
}

export function isCountryCode(value: string): boolean {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

/** Dialling codes offered in the phone field. */
export const DIAL_CODES = [
  { code: "+258", country: "MZ" },
  { code: "+27", country: "ZA" },
  { code: "+351", country: "PT" },
  { code: "+55", country: "BR" },
  { code: "+244", country: "AO" },
  { code: "+263", country: "ZW" },
  { code: "+265", country: "MW" },
  { code: "+255", country: "TZ" },
  { code: "+260", country: "ZM" },
  { code: "+268", country: "SZ" },
  { code: "+238", country: "CV" },
  { code: "+44", country: "GB" },
  { code: "+1", country: "US" },
] as const;

/** Split an E.164 number into dial code and national part for editing. */
export function splitPhone(e164: string | null | undefined): { dial: string; national: string } {
  if (!e164) return { dial: "+258", national: "" };
  const match = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length).find((d) => e164.startsWith(d.code));
  if (match) return { dial: match.code, national: e164.slice(match.code.length) };
  return { dial: "+258", national: e164.replace(/^\+/, "") };
}

/**
 * Normalise a phone number to E.164. Mozambican mobiles must be 9 digits
 * starting 82–87 (e.g. +258 84 123 4567); other countries are checked loosely.
 * Returns null if invalid.
 */
export function toE164(dial: string, national: string): string | null {
  const digits = national.replace(/[\s\-().]/g, "").replace(/^0+/, "");
  if (!/^\d+$/.test(digits)) return null;
  if (dial === "+258") return /^8[2-7]\d{7}$/.test(digits) ? `+258${digits}` : null;
  const full = `${dial}${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(full) ? full : null;
}

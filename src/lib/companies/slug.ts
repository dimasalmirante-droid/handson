/** Build a URL-safe suggestion for the employer's future public page slug. */
export function suggestCompanySlug(companyName: string): string {
  return companyName
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

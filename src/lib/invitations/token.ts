import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invitation tokens. A token is 32 random bytes (base64url, 43 characters)
 * sent only in the invitation email. The database stores only its SHA-256
 * hash (hex), so a database leak cannot be turned into working invitation
 * links. Tokens are never logged.
 */
export const INVITATION_TTL_DAYS = 7;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
}

/** Accepts only the shape generateInvitationToken produces, before any database lookup. */
export function isWellFormedToken(token: string | null | undefined): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function invitationExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 86_400_000);
}

/** Constant-time comparison of two hex hashes. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

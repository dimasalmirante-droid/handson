import { afterEach, describe, expect, it, vi } from "vitest";
import { describeRequest, hostOf } from "../auth/oauth-diagnostics";
import { googleCallbackUrl } from "../auth/oauth";
import { originFromHeaders } from "../auth/origin";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const h = (o: Record<string, string>) => new Headers(o);

describe("originFromHeaders precedence", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers x-forwarded-host over host", () => {
    expect(originFromHeaders(h({ host: "internal", "x-forwarded-host": "preview.vercel.app", "x-forwarded-proto": "https" })))
      .toBe("https://preview.vercel.app");
  });
  it("uses host when no forwarded host", () => {
    expect(originFromHeaders(h({ host: "preview.vercel.app" }))).toBe("https://preview.vercel.app");
  });
  it("uses http for localhost", () => {
    expect(originFromHeaders(h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
  it("ignores referer and origin headers entirely", () => {
    expect(originFromHeaders(h({ host: "preview.vercel.app", referer: "https://staging.handson.cloud/login", origin: "https://staging.handson.cloud" })))
      .toBe("https://preview.vercel.app");
  });
  it("falls back to NEXT_PUBLIC_APP_URL only with no host at all", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.handson.cloud");
    expect(originFromHeaders(h({}))).toBe("https://staging.handson.cloud");
    expect(originFromHeaders(h({ host: "preview.vercel.app" }))).toBe("https://preview.vercel.app");
  });
  it("builds the callback on the request host", () => {
    const origin = originFromHeaders(h({ "x-forwarded-host": "preview.vercel.app", "x-forwarded-proto": "https" }));
    expect(new URL(googleCallbackUrl(origin, { intent: "student" })).host).toBe("preview.vercel.app");
  });
});

describe("describeRequest", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports hosts and deployment, never paths, queries or cookie values", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "employer/step1");
    const d = describeRequest(
      h({
        host: "a.vercel.app",
        "x-forwarded-host": "a.vercel.app",
        "x-forwarded-proto": "https",
        referer: "https://staging.handson.cloud/login?code=SECRET&state=S",
        cookie: "sb-x-auth-token-code-verifier=SECRETVALUE",
      }),
      { cookieNames: ["sb-x-auth-token-code-verifier"] },
    );
    expect(d.refererHost).toBe("staging.handson.cloud");
    expect(d.deployment.gitRef).toBe("employer/step1");
    expect(d.hasPkceVerifierCookie).toBe(true);
    const json = JSON.stringify(d);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("code=");
  });
  it("omits the cookie flag when names are not given; hostOf tolerates junk", () => {
    expect("hasPkceVerifierCookie" in describeRequest(h({}))).toBe(false);
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
});

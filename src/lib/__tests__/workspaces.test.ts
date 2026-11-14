import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideDestination, listWorkspaces, workspaceKeyForPath, type Contexts } from "../auth/destination";
import { googleCallbackUrl } from "../auth/oauth";
import { isProtectedPath, safeNextPath } from "../auth/redirects";
import { workspacesView } from "../auth/workspaces-view";
import { previewUsesProductionDatabase } from "../env";
import { generateInvitationToken, hashInvitationToken, invitationExpiry, isWellFormedToken, sameHash } from "../invitations/token";
import { legalBlocks } from "../legal";

vi.mock("server-only", () => ({}));

const CO1 = "11111111-1111-4111-8111-111111111111";
const CO2 = "22222222-2222-4222-8222-222222222222";

function ctx(over: Partial<Contexts> = {}): Contexts {
  return { account_status: "active", student: null, admin_role: null, companies: [], ...over };
}
const student = (done = true) => ({ onboarding_completed: done });
const company = (id: string, over: Partial<Contexts["companies"][number]> = {}) => ({
  id, name: `Company ${id.slice(0, 1)}`, slug: `co-${id.slice(0, 1)}`, status: "active" as const, role: "editor" as const, ...over,
});

describe("decideDestination", () => {
  it("students go to onboarding, or to the dashboard once finished (unchanged)", () => {
    expect(decideDestination(ctx({ student: student(false) }))).toBe("/onboarding");
    expect(decideDestination(ctx({ student: student(true) }))).toBe("/dashboard");
  });

  it("administrators still land on /admin, including those with a student profile or a company", () => {
    expect(decideDestination(ctx({ admin_role: "reviewer" }))).toBe("/admin");
    expect(decideDestination(ctx({ admin_role: "super_admin", student: student() }))).toBe("/admin");
    expect(decideDestination(ctx({ admin_role: "admin", student: student(), companies: [company(CO1)] }))).toBe("/admin");
  });

  it("employer-only users with one company go straight to it", () => {
    expect(decideDestination(ctx({ companies: [company(CO1)] }))).toBe(`/employer/${CO1}`);
  });

  it("people with several workspaces (and no admin role) choose", () => {
    expect(decideDestination(ctx({ student: student(), companies: [company(CO1)] }))).toBe("/workspaces");
    expect(decideDestination(ctx({ companies: [company(CO1), company(CO2)] }))).toBe("/workspaces");
  });

  it("people with no workspace go to the chooser, where they can create a student profile", () => {
    expect(decideDestination(ctx())).toBe("/workspaces");
  });

  it("suspended accounts are signed out, whatever else they have", () => {
    expect(decideDestination(ctx({ account_status: "suspended", student: student(), admin_role: "super_admin" }), { next: "/admin" })).toBe(
      "/auth/signout?reason=suspended",
    );
  });

  it("a safe next path wins; unsafe ones are ignored", () => {
    expect(decideDestination(ctx({ student: student() }), { next: "/dashboard/settings" })).toBe("/dashboard/settings");
    expect(decideDestination(ctx({ student: student() }), { next: "/invite" })).toBe("/invite");
    for (const bad of ["https://evil.example", "//evil.example", "/auth/callback", "/start"]) {
      expect(decideDestination(ctx({ student: student() }), { next: bad })).toBe("/dashboard");
    }
  });

  it("a remembered workspace is used only while it is still one of the person's workspaces", () => {
    const c = ctx({ admin_role: "admin", student: student(), companies: [company(CO1)] });
    expect(decideDestination(c, { remembered: "student" })).toBe("/dashboard");
    expect(decideDestination(c, { remembered: `company:${CO1}` })).toBe(`/employer/${CO1}`);
    expect(decideDestination(c, { remembered: `company:${CO2}` })).toBe("/admin"); // not a member: ignored
    expect(decideDestination(ctx({ companies: [company(CO1)] }), { remembered: "admin" })).toBe(`/employer/${CO1}`); // not an admin: ignored
    expect(decideDestination(ctx({ companies: [company(CO1)] }), { remembered: "student" })).toBe(`/employer/${CO1}`); // no profile: ignored
  });
});

describe("listWorkspaces", () => {
  it("lists student, admin and companies in a stable order", () => {
    const ws = listWorkspaces(ctx({ admin_role: "admin", student: student(false), companies: [company(CO1, { role: "company_admin" })] }));
    expect(ws.map((w) => [w.key, w.href])).toEqual([
      ["student", "/onboarding"],
      ["admin", "/admin"],
      [`company:${CO1}`, `/employer/${CO1}`],
    ]);
    expect(ws[2].detail).toBe("Company administrator");
  });

  it("marks suspended companies", () => {
    expect(listWorkspaces(ctx({ companies: [company(CO1, { status: "suspended" })] }))[0].detail).toBe("Suspended");
  });

  it("returns nothing for suspended accounts", () => {
    expect(listWorkspaces(ctx({ account_status: "suspended", student: student() }))).toEqual([]);
  });

  it("only people with more than one workspace see the switcher", () => {
    expect(listWorkspaces(ctx({ student: student() }))).toHaveLength(1);
    expect(listWorkspaces(ctx({ student: student(), admin_role: "admin" }))).toHaveLength(2);
  });
});

describe("workspaceKeyForPath", () => {
  it("maps paths to workspaces", () => {
    expect(workspaceKeyForPath("/dashboard/settings")).toBe("student");
    expect(workspaceKeyForPath("/onboarding")).toBe("student");
    expect(workspaceKeyForPath("/admin/students")).toBe("admin");
    expect(workspaceKeyForPath(`/employer/${CO1}`)).toBe(`company:${CO1}`);
    expect(workspaceKeyForPath("/workspaces")).toBeNull();
  });
});

describe("/workspaces view", () => {
  it("offers a student profile, alongside a pending invitation, to anyone without one", () => {
    expect(workspacesView({ workspaces: [], hasStudentProfile: false, pendingInvitations: 1 })).toEqual({
      empty: true, showInvitations: true, showCreateStudentProfile: true,
    });
  });

  it("offers it to employer-only users too, and not to students", () => {
    const employer = listWorkspaces(ctx({ companies: [company(CO1)] }));
    expect(workspacesView({ workspaces: employer, hasStudentProfile: false, pendingInvitations: 0 }).showCreateStudentProfile).toBe(true);
    const s = listWorkspaces(ctx({ student: student() }));
    expect(workspacesView({ workspaces: s, hasStudentProfile: true, pendingInvitations: 0 })).toEqual({
      empty: false, showInvitations: false, showCreateStudentProfile: false,
    });
  });
});

describe("protected routes", () => {
  it("cover the new workspace routes", () => {
    for (const p of ["/start", "/workspaces", `/employer/${CO1}`, "/legal/accept"]) expect(isProtectedPath(p)).toBe(true);
    for (const p of ["/legal/terms", "/legal/privacy", "/signout"]) expect(isProtectedPath(p)).toBe(false);
  });
});

describe("Google sign-in return address", () => {
  const origin = "https://app.handson.cloud";

  it("keeps a safe next path such as /invite and never carries an invitation token", () => {
    const url = new URL(googleCallbackUrl(origin, { next: "/invite" }));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBe("/invite");
    expect(url.searchParams.has("intent")).toBe(false);
    expect([...url.searchParams.keys()]).toEqual(["next"]);
  });

  it("adds intent=student only when asked by the registration page", () => {
    expect(new URL(googleCallbackUrl(origin, { intent: "student" })).searchParams.get("intent")).toBe("student");
    expect(new URL(googleCallbackUrl(origin, { intent: "admin" })).searchParams.has("intent")).toBe(false);
  });

  it("drops unsafe next paths", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/auth/confirm"]) {
      expect(new URL(googleCallbackUrl(origin, { next: bad })).searchParams.has("next")).toBe(false);
    }
  });

  it("safeNextPath accepts the invitation page for email confirmation links", () => {
    expect(safeNextPath("/invite", "/start")).toBe("/invite");
  });
});

describe("staging isolation", () => {
  it("refuses a preview deployment configured with the production database", () => {
    const prod = "https://mcqrcwlvvdbhpmfretdu.supabase.co";
    expect(previewUsesProductionDatabase({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: prod })).toBe(true);
    expect(previewUsesProductionDatabase({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "https://stagingref.supabase.co" })).toBe(false);
    expect(previewUsesProductionDatabase({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: prod })).toBe(false);
    expect(previewUsesProductionDatabase({ NEXT_PUBLIC_SUPABASE_URL: prod })).toBe(false);
  });
});

describe("invitation tokens", () => {
  it("are 256-bit random values stored only as SHA-256 hashes", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(isWellFormedToken(a.token)).toBe(true);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashInvitationToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });

  it("rejects malformed tokens before any lookup", () => {
    for (const bad of ["", "short", "x".repeat(44), "a".repeat(42) + "!", null, undefined]) expect(isWellFormedToken(bad)).toBe(false);
  });

  it("compares hashes in constant time", () => {
    const { hash } = generateInvitationToken();
    expect(sameHash(hash, hash)).toBe(true);
    expect(sameHash(hash, generateInvitationToken().hash)).toBe(false);
    expect(sameHash(hash, "")).toBe(false);
  });

  it("expire after seven days", () => {
    const from = new Date("2026-11-10T10:00:00Z");
    expect(invitationExpiry(from).toISOString()).toBe("2026-11-17T10:00:00.000Z");
  });
});

describe("legal text rendering", () => {
  it("turns plain text into headings and paragraphs, without interpreting HTML", () => {
    expect(legalBlocks("# Title\n\nFirst para\nline two\n\n## Sub\n\n<script>x</script>")).toEqual([
      { type: "h2", text: "Title" },
      { type: "p", text: "First para\nline two" },
      { type: "h3", text: "Sub" },
      { type: "p", text: "<script>x</script>" },
    ]);
  });
});

describe("Google callback: student profile creation", () => {
  let calls: string[];
  let contexts: Record<string, unknown>;
  const client = () =>
    ({
      rpc: async (name: string) => {
        calls.push(name);
        if (name === "my_contexts") return { data: contexts, error: null };
        return { data: null, error: null };
      },
    }) as never;

  beforeEach(() => {
    calls = [];
  });

  it("creates a profile only for an account with no workspace at all", async () => {
    const { ensureStudentProfile } = await import("../auth/student-profile");
    contexts = { account_status: "active", student: null, admin_role: null, companies: [] };
    expect(await ensureStudentProfile(client())).toBe("created");
    expect(calls).toEqual(["my_contexts", "create_student_profile"]);
  });

  it("never adds a profile to students, admins, employer users or suspended accounts", async () => {
    const { ensureStudentProfile } = await import("../auth/student-profile");
    for (const c of [
      { account_status: "active", student: { onboarding_completed: false }, admin_role: null, companies: [] },
      { account_status: "active", student: null, admin_role: "admin", companies: [] },
      { account_status: "active", student: null, admin_role: null, companies: [{ id: CO1 }] },
      { account_status: "suspended", student: null, admin_role: null, companies: [] },
    ]) {
      calls = [];
      contexts = c;
      expect(await ensureStudentProfile(client())).toBe("skipped");
      expect(calls).toEqual(["my_contexts"]);
    }
  });
});

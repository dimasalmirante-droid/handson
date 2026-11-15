import { afterEach, describe, expect, it, vi } from "vitest";
import { InvitationEmailError, sendInvitationEmail } from "./email-provider";

vi.mock("server-only", () => ({}));

const input = {
  to: "people.lead@example.com",
  subject: "Your Handson invitation",
  html: "<p>Invitation</p>",
  text: "Invitation",
  idempotencyKey: "company-admin-invitation-123-abc",
};

describe("sendInvitationEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refuses to send when the server-only key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendInvitationEmail(input)).rejects.toBeInstanceOf(InvitationEmailError);
    await expect(sendInvitationEmail(input)).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through Resend with the verified sender and an idempotency key", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendInvitationEmail(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-resend-key");
    expect(new Headers(init.headers).get("idempotency-key")).toBe(input.idempotencyKey);
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "Handson <hello@handson.cloud>",
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not expose provider response content when Resend rejects a request", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("recipient and provider details", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendInvitationEmail(input)).rejects.toThrow(/did not accept/i);
    expect(log).toHaveBeenCalledWith("Resend invitation email request failed", 422);
    expect(log.mock.calls.flat().join(" ")).not.toContain("recipient and provider details");
  });

  it("returns a safe error when the provider cannot be reached", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    const fetchMock = vi.fn().mockRejectedValue(new Error("network details"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendInvitationEmail(input)).rejects.toThrow(/could not be reached/i);
  });
});

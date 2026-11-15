import "server-only";

export class InvitationEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationEmailError";
  }
}

export async function sendInvitationEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new InvitationEmailError("Invitation email delivery is not configured.");
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Handson/1.0",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: "Handson <hello@handson.cloud>",
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      cache: "no-store",
    });
  } catch {
    throw new InvitationEmailError("The email provider could not be reached. Please try again.");
  }

  if (!response.ok) {
    // Do not log the provider response: it can contain the recipient address
    // or other personal data. The status is sufficient for troubleshooting.
    console.error("Resend invitation email request failed", response.status);
    throw new InvitationEmailError("The email provider did not accept the invitation email.");
  }
}

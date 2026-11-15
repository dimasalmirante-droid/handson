export type FirstCompanyAdminEmailInput = {
  companyName: string;
  fullName: string;
  inviteUrl: string;
  expiresAt: Date;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function firstCompanyAdminInvitationEmail(input: FirstCompanyAdminEmailInput) {
  const company = input.companyName.trim();
  const name = input.fullName.trim() || "there";
  const date = input.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Maputo",
  });
  const safeCompany = escapeHtml(company);
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(input.inviteUrl);

  return {
    subject: `You're invited to manage ${company} on Handson`,
    text: [
      `Hello ${name},`,
      "",
      `You've been appointed as the first Company Administrator for ${company} on Handson.`,
      "Handson connects employers with students and early-career talent. Your company workspace will let you manage your organisation's presence and team on the platform.",
      "",
      `Accept your invitation: ${input.inviteUrl}`,
      "",
      `This invitation expires on ${date}. It can only be accepted using the email address this invitation was sent to.`,
      "",
      "If you were not expecting this invitation, you can ignore this email.",
      "",
      "Handson",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f7f6f3;font-family:Arial,Helvetica,sans-serif;color:#17151f">
    <main style="max-width:560px;margin:0 auto;padding:36px;background:#ffffff;border:1px solid #e7e4df;border-radius:18px">
      <p style="margin:0 0 28px;font-size:26px;font-weight:700;letter-spacing:-1px">handson<span style="color:#d2f45b">.</span></p>
      <p style="margin:0 0 12px;color:#5b5766;font-size:15px">Employer workspace invitation</p>
      <h1 style="margin:0 0 20px;font-size:28px;line-height:1.2">Welcome to Handson, ${safeName}</h1>
      <p style="font-size:16px;line-height:1.65">You've been invited to become the first Company Administrator for <strong>${safeCompany}</strong>.</p>
      <p style="font-size:16px;line-height:1.65">Accept the invitation to access your company's Handson workspace. Use the same email address that received this message.</p>
      <p style="margin:28px 0">
        <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#392bd6;color:#ffffff;text-decoration:none;font-weight:700">Accept invitation</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#6b6675">This link expires on ${date}. For your security, it can only be used by the invited email address.</p>
      <hr style="margin:28px 0;border:0;border-top:1px solid #e7e4df" />
      <p style="font-size:13px;line-height:1.6;color:#6b6675">If you were not expecting this invitation, you can ignore this email.</p>
      <p style="margin:22px 0 0;font-size:13px;color:#6b6675">Handson · Early-career talent, connected.</p>
    </main>
  </body>
</html>`,
  };
}

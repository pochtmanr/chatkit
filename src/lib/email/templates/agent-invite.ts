// Plain HTML invite template — no React Email package. The palette
// (ink #0B0B0B, deep #2B4559, mist #E4E4E4) mirrors the dashboard so
// the visual lineage is obvious when the invitee clicks through.

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function agentInviteEmail(args: {
  businessName: string;
  inviterName: string;
  acceptUrl: string;
  displayName: string;
  role: "agent" | "manager";
}): { subject: string; html: string; text: string } {
  const business = escape(args.businessName);
  const inviter = escape(args.inviterName);
  const display = escape(args.displayName);
  const roleLabel = args.role === "manager" ? "team manager" : "support agent";
  const acceptUrl = args.acceptUrl;
  const acceptUrlEscaped = escape(acceptUrl);

  const subject = `${args.inviterName} invited you to ${args.businessName} on Chatkit`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escape(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F6F6F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B0B0B;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F6F6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #E4E4E4;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#2B4559;">Chatkit</p>
                <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.3;font-weight:600;color:#0B0B0B;">Hi ${display},</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;font-size:15px;line-height:1.55;color:#0B0B0B;">
                <p style="margin:0 0 16px 0;">
                  ${inviter} invited you to join <strong>${business}</strong>
                  as a ${roleLabel} on Chatkit.
                </p>
                <p style="margin:0 0 24px 0;color:#2B4559;">
                  Set your password and you’ll land in the workbench, ready
                  to pick up customer conversations.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <a href="${acceptUrlEscaped}" style="display:inline-block;background:#0B0B0B;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:500;">
                  Accept invitation
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;font-size:12px;line-height:1.55;color:#2B4559;">
                <p style="margin:0 0 8px 0;">Or paste this link into your browser:</p>
                <p style="margin:0;word-break:break-all;">
                  <a href="${acceptUrlEscaped}" style="color:#2B4559;">${acceptUrlEscaped}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px;border-top:1px solid #E4E4E4;font-size:12px;line-height:1.5;color:#2B4559;">
                This invite expires in 7 days. If you didn’t expect it,
                ignore this email and nothing happens.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${args.displayName},`,
    "",
    `${args.inviterName} invited you to join ${args.businessName} as a ${roleLabel} on Chatkit.`,
    "",
    "Accept the invitation:",
    acceptUrl,
    "",
    "This invite expires in 7 days. If you didn't expect it, ignore this email.",
  ].join("\n");

  return { subject, html, text };
}

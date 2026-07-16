import { EMAIL_LEGAL_FOOTER } from './email-footer';
const BASE_STYLE = `margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const WRAPPER = `width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"`;
const CARD = `width="100%" style="max-width:520px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:40px 36px"`;
const BRAND = `style="margin:0 0 20px;font-size:13px;color:#6b7280;font-weight:600;letter-spacing:.04em;text-transform:uppercase"`;

export interface InvitationAcceptedEmailData {
  to: string;
  agentName: string;
  firmName: string;
  clientName: string;
  clientUrl: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function invitationAcceptedTemplate(data: InvitationAcceptedEmailData): string {
  const { agentName, firmName, clientName, clientUrl } = data;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <table ${WRAPPER}>
    <tr><td align="center">
      <table ${CARD}>
        <tr><td>
          <p ${BRAND}>${escapeHtml(firmName)}</p>
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827">
            Client invitation accepted
          </h2>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7">
            Hi ${escapeHtml(agentName)},
          </p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7">
            <strong>${escapeHtml(clientName)}</strong> has accepted the HMRC authorisation invitation.
            You can now manage their Making Tax Digital submissions.
          </p>
          <p style="margin:24px 0 0">
            <a href="${escapeHtml(clientUrl)}"
               style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:10px 24px;border-radius:6px;text-decoration:none">
              View client
            </a>
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
            You are receiving this because your firm has invitation notifications enabled.
            Manage preferences in Settings &rarr; Notifications.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${EMAIL_LEGAL_FOOTER}
</body>
</html>`;
}

export function invitationAcceptedPlainText(data: InvitationAcceptedEmailData): string {
  return `Hi ${data.agentName},\n\n${data.clientName} has accepted the HMRC authorisation invitation.\nYou can now manage their Making Tax Digital submissions.\n\nView client: ${data.clientUrl}\n\n${data.firmName}`;
}

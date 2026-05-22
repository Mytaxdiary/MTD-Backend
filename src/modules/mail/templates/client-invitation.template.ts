const BASE_STYLE = `margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const WRAPPER = `width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"`;
const CARD = `width="100%" style="max-width:520px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:40px 36px"`;
const BRAND = `style="margin:0 0 20px;font-size:13px;color:#6b7280;font-weight:600;letter-spacing:.04em;text-transform:uppercase"`;

const DEFAULT_MESSAGE =
  "Hi {name}, we're setting up your Making Tax Digital account. You'll receive an email from HMRC shortly — please accept the authorisation link so we can manage your quarterly updates.";

export interface ClientInvitationEmailData {
  to: string;
  clientName: string;
  agentName: string;
  firmName: string;
  personalMessage?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function clientInvitationTemplate(data: ClientInvitationEmailData): string {
  const { clientName, agentName, firmName, personalMessage } = data;
  const bodyText =
    personalMessage?.trim() ||
    DEFAULT_MESSAGE.replace(/\{name\}/g, clientName);
  const bodyHtml = escapeHtml(bodyText).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <table ${WRAPPER}>
    <tr><td align="center">
      <table ${CARD}>
        <tr><td>
          <p ${BRAND}>${escapeHtml(firmName)}</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap">${bodyHtml}</p>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5">
            — ${escapeHtml(agentName)}, ${escapeHtml(firmName)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function clientInvitationPlainText(data: ClientInvitationEmailData): string {
  const bodyText =
    data.personalMessage?.trim() ||
    DEFAULT_MESSAGE.replace(/\{name\}/g, data.clientName);
  return `${bodyText}\n\n— ${data.agentName}, ${data.firmName}`;
}

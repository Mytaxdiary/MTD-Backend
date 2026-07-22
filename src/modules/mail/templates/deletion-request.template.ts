import { EMAIL_LEGAL_FOOTER } from './email-footer';

const BASE_STYLE = `margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const WRAPPER = `width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"`;
const CARD = `width="100%" style="max-width:520px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:40px 36px"`;
const BRAND = `style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;letter-spacing:.04em;text-transform:uppercase"`;

export interface DeletionRequestEmailData {
  to: string;
  firstName: string;
  executeDate: string;
  settingsUrl: string;
}

export function deletionRequestTemplate(data: DeletionRequestEmailData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <table ${WRAPPER}>
    <tr><td align="center">
      <table ${CARD}>
        <tr><td>
          <p ${BRAND}>My Tax Diary</p>
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;font-weight:700">Account deletion requested</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
            Hi ${data.firstName},
          </p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
            We have received a request to permanently delete your My Tax Diary account and all associated firm data.
            Your account will be deleted on <strong>${data.executeDate}</strong>.
          </p>
          <div style="margin:0 0 20px;padding:14px 18px;background:#FFF5F5;border-radius:8px;border:1px solid #FECACA">
            <p style="margin:0;font-size:13px;color:#B91C1C;line-height:1.6">
              This will permanently delete all your clients, notes, chase history, portal messages, and uploaded files.
              This action cannot be undone once executed.
            </p>
          </div>
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">
            If you did not make this request or would like to cancel it, go to <strong>Settings &gt; Data &amp; Privacy</strong> before the date above.
          </p>
          <a href="${data.settingsUrl}" style="display:inline-block;padding:12px 28px;background:#DC2626;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none">Cancel deletion</a>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6">
            If you have questions, contact us at info@mytaxdiary.co.uk.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${EMAIL_LEGAL_FOOTER}
</body>
</html>`;
}

export function deletionRequestPlainText(data: DeletionRequestEmailData): string {
  return `Hi ${data.firstName},

We have received a request to permanently delete your My Tax Diary account and all associated firm data. Your account will be deleted on ${data.executeDate}.

This will permanently delete all your clients, notes, chase history, portal messages, and uploaded files. This action cannot be undone once executed.

If you did not make this request or would like to cancel it, go to Settings > Data & Privacy before the date above, or visit:
${data.settingsUrl}

If you have questions, contact us at info@mytaxdiary.co.uk.

My Tax Diary Ltd`;
}

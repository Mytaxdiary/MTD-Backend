import { EMAIL_LEGAL_FOOTER } from './email-footer';

const BASE_STYLE = `margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const WRAPPER = `width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"`;
const CARD = `width="100%" style="max-width:520px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:40px 36px"`;
const BRAND = `style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;letter-spacing:.04em;text-transform:uppercase"`;
const BTN = `style="display:inline-block;padding:12px 28px;background:#2563EB;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none"`;

export type TrialEndingEmailData = {
  firstName: string;
  firmName: string;
  trialEndsAt: Date | string;
  pricingUrl: string;
  billingUrl: string;
};

function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function trialEndingTemplate(data: TrialEndingEmailData): string {
  const ends = formatDate(data.trialEndsAt);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <table ${WRAPPER}>
    <tr><td align="center">
      <table ${CARD}>
        <tr><td>
          <p ${BRAND}>My Tax Diary</p>
          <h1 style="margin:0 0 20px;font-size:22px;color:#111827;font-weight:700">Your free trial ends in 2 days</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
            Hi ${data.firstName}, the free trial for <strong>${data.firmName}</strong> ends on
            <strong>${ends}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
            Subscribe anytime to keep managing clients and quarterly submissions. Pricing is
            £50/month for up to 50 clients.
          </p>
          <a href="${data.billingUrl}" ${BTN}>Open Plan &amp; billing</a>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6">
            Or review <a href="${data.pricingUrl}" style="color:#2563EB">pricing</a> first.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${EMAIL_LEGAL_FOOTER}
</body>
</html>`;
}

export function trialEndingPlainText(data: TrialEndingEmailData): string {
  return `Hi ${data.firstName},

Your free trial for ${data.firmName} ends on ${formatDate(data.trialEndsAt)} (in about 2 days).

Subscribe from Plan & billing to keep using My Tax Diary:
${data.billingUrl}

Pricing: ${data.pricingUrl}

The My Tax Diary team`;
}

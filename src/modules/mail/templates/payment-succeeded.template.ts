import { EMAIL_LEGAL_FOOTER } from './email-footer';

const BASE_STYLE = `margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const WRAPPER = `width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"`;
const CARD = `width="100%" style="max-width:520px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:40px 36px"`;
const BRAND = `style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;letter-spacing:.04em;text-transform:uppercase"`;
const BTN = `style="display:inline-block;padding:12px 28px;background:#2563EB;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none"`;

export type PaymentSucceededEmailData = {
  firstName: string;
  firmName: string;
  amountLabel?: string | null;
  billingUrl: string;
};

export function paymentSucceededTemplate(data: PaymentSucceededEmailData): string {
  const amountLine = data.amountLabel
    ? `<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
            Amount: <strong>${data.amountLabel}</strong>.
          </p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <table ${WRAPPER}>
    <tr><td align="center">
      <table ${CARD}>
        <tr><td>
          <p ${BRAND}>My Tax Diary</p>
          <h1 style="margin:0 0 20px;font-size:22px;color:#111827;font-weight:700">Payment received</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
            Hi ${data.firstName}, thanks. We received payment for <strong>${data.firmName}</strong>.
            Your subscription is active.
          </p>
          ${amountLine}
          <a href="${data.billingUrl}" ${BTN}>View Plan &amp; billing</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${EMAIL_LEGAL_FOOTER}
</body>
</html>`;
}

export function paymentSucceededPlainText(data: PaymentSucceededEmailData): string {
  const amount = data.amountLabel ? `\nAmount: ${data.amountLabel}\n` : '';
  return `Hi ${data.firstName},

Thanks. We received payment for ${data.firmName}. Your subscription is active.${amount}
Plan & billing: ${data.billingUrl}

The My Tax Diary team`;
}

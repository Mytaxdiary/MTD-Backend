import { EMAIL_LEGAL_FOOTER } from './email-footer';

const BASE_STYLE = `margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const WRAPPER = `width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"`;
const CARD = `width="100%" style="max-width:560px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:40px 36px"`;
const BRAND = `style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;letter-spacing:.04em;text-transform:uppercase"`;
const ROW = `style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.55"`;

export interface EnquiryAlertEmailData {
  name: string;
  firm: string;
  email: string;
  phone?: string | null;
  message: string;
  sourcePage?: string | null;
  planInterest?: string | null;
  enquiryId: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function enquiryAlertTemplate(data: EnquiryAlertEmailData): string {
  const phone = data.phone?.trim() ? escapeHtml(data.phone.trim()) : '—';
  const source = data.sourcePage?.trim() ? escapeHtml(data.sourcePage.trim()) : '—';
  const plan = data.planInterest?.trim() ? escapeHtml(data.planInterest.trim()) : '—';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <table ${WRAPPER}>
    <tr><td align="center">
      <table ${CARD}>
        <tr><td>
          <p ${BRAND}>My Tax Diary</p>
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;font-weight:700">New marketing enquiry</h1>
          <p ${ROW}><strong>Name:</strong> ${escapeHtml(data.name)}</p>
          <p ${ROW}><strong>Firm:</strong> ${escapeHtml(data.firm)}</p>
          <p ${ROW}><strong>Email:</strong> ${escapeHtml(data.email)}</p>
          <p ${ROW}><strong>Phone:</strong> ${phone}</p>
          <p ${ROW}><strong>Plan interest:</strong> ${plan}</p>
          <p ${ROW}><strong>Source:</strong> ${source}</p>
          <p ${ROW}><strong>Enquiry ID:</strong> ${escapeHtml(data.enquiryId)}</p>
          <div style="margin:18px 0 0;padding:14px 18px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">
            <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;letter-spacing:.04em;text-transform:uppercase">Message</p>
            <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.message)}</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${EMAIL_LEGAL_FOOTER}
</body>
</html>`;
}

export function enquiryAlertPlainText(data: EnquiryAlertEmailData): string {
  return `New marketing enquiry

Name: ${data.name}
Firm: ${data.firm}
Email: ${data.email}
Phone: ${data.phone?.trim() || '—'}
Plan interest: ${data.planInterest?.trim() || '—'}
Source: ${data.sourcePage?.trim() || '—'}
Enquiry ID: ${data.enquiryId}

Message:
${data.message}
`;
}

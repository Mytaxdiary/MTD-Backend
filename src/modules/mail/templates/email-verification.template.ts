const BASE_STYLE = `margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const WRAPPER = `width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"`;
const CARD = `width="100%" style="max-width:520px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:40px 36px"`;
const BRAND = `style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;letter-spacing:.04em;text-transform:uppercase"`;
const BTN = `style="display:inline-block;padding:12px 28px;background:#2563EB;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none"`;

export function emailVerificationTemplate(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <table ${WRAPPER}>
    <tr><td align="center">
      <table ${CARD}>
        <tr><td>
          <p ${BRAND}>NewEffect MTD ITSA</p>
          <h1 style="margin:0 0 20px;font-size:22px;color:#111827;font-weight:700">Verify your email</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
            Click the button below to confirm your email address. This link is valid for <strong>24 hours</strong>.
          </p>
          <a href="${verifyUrl}" ${BTN}>Verify email</a>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6">
            If you did not create an account with MTD ITSA, you can safely ignore this email.<br>
            If the button above doesn't work, copy and paste this link:<br>
            <a href="${verifyUrl}" style="color:#2563EB;word-break:break-all">${verifyUrl}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

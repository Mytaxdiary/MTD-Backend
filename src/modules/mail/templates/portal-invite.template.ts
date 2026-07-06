export interface PortalInviteEmailData {
  clientName: string;
  firmName: string;
  setupUrl: string;
  expiryDays: number;
}

export function portalInviteTemplate(d: PortalInviteEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set up your client portal</title>
<style>body{margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden}
.hdr{background:#1E3A5F;padding:28px 36px}.hdr h1{margin:0;color:#fff;font-size:20px;font-weight:700}
.body{padding:32px 36px}.body p{margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6}
.btn{display:inline-block;padding:13px 28px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0 20px}
.note{background:#F1F5F9;border-radius:8px;padding:14px 18px;font-size:13px;color:#64748B}
.footer{padding:18px 36px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8}
</style></head>
<body>
<div class="wrap">
  <div class="hdr"><h1>Your client portal is ready</h1></div>
  <div class="body">
    <p>Hi ${d.clientName},</p>
    <p>${d.firmName} has set up a secure client portal for you. You can use it to:</p>
    <ul style="color:#334155;font-size:15px;line-height:1.8;padding-left:20px">
      <li>View your HMRC submissions and upcoming deadlines</li>
      <li>Check your current tax liabilities and payment details</li>
      <li>Read messages from your accountant</li>
    </ul>
    <p>Click the button below to set your password and access your portal:</p>
    <a href="${d.setupUrl}" class="btn">Set up my portal</a>
    <div class="note">This link expires in ${d.expiryDays} days. If you did not expect this email, please contact ${d.firmName} directly.</div>
  </div>
  <div class="footer">Sent on behalf of ${d.firmName} via NewEffect MTD ITSA</div>
</div>
</body></html>`;
}

export function portalInvitePlainText(d: PortalInviteEmailData): string {
  return `Hi ${d.clientName},

${d.firmName} has set up a secure client portal for you.

Set up your portal here: ${d.setupUrl}

This link expires in ${d.expiryDays} days.`;
}

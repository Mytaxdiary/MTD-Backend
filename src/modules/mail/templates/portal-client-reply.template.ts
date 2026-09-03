import { EMAIL_LEGAL_FOOTER_DIV } from './email-footer';

export interface PortalClientReplyEmailData {
  agentName: string;
  clientName: string;
  firmName: string;
  subject: string;
  body: string;
  clientDetailUrl: string;
}

export function portalClientReplyTemplate(d: PortalClientReplyEmailData): string {
  const bodyHtml = d.body.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${d.subject}</title>
<style>body{margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden}
.hdr{background:#1E3A5F;padding:28px 36px}.hdr h1{margin:0;color:#fff;font-size:20px;font-weight:700}
.body{padding:32px 36px}.body p{margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6}
.msg-box{background:#F8FAFC;border-left:3px solid #1E3A5F;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;color:#334155;font-size:15px;line-height:1.7}
.btn{display:inline-block;padding:13px 28px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0 20px}
.footer{padding:18px 36px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8}
</style></head>
<body>
<div class="wrap">
  <div class="hdr"><h1>New portal message from ${d.clientName}</h1></div>
  <div class="body">
    <p>Hi ${d.agentName},</p>
    <p><strong>${d.clientName}</strong> sent a message in the client portal:</p>
    <div class="msg-box"><strong>${d.subject}</strong><br><br>${bodyHtml}</div>
    <a href="${d.clientDetailUrl}" class="btn">Open client</a>
    <p style="font-size:13px;color:#64748B">This is portal chat, not an email chase.</p>
  </div>
  <div class="footer">${d.firmName} via My Tax Diary</div>
  ${EMAIL_LEGAL_FOOTER_DIV}
</div>
</body></html>`;
}

export function portalClientReplyPlainText(d: PortalClientReplyEmailData): string {
  return `Hi ${d.agentName},

${d.clientName} sent a portal message:

${d.subject}

${d.body}

Open client: ${d.clientDetailUrl}

This is portal chat, not an email chase.`;
}

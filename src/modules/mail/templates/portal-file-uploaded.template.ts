import { EMAIL_LEGAL_FOOTER_DIV } from './email-footer';
export interface PortalFileUploadedEmailData {
  agentEmail: string;
  clientName: string;
  firmName: string;
  fileName: string;
  fileSize: string;
  clientDetailUrl: string;
}

export function portalFileUploadedTemplate(d: PortalFileUploadedEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New file from ${d.clientName}</title>
<style>body{margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden}
.hdr{background:#1E3A5F;padding:28px 36px}.hdr h1{margin:0;color:#fff;font-size:20px;font-weight:700}
.body{padding:32px 36px}.body p{margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6}
.file-box{background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:12px;margin:20px 0}
.file-icon{font-size:24px}.file-info{flex:1}.file-name{font-weight:600;color:#0C4A6E;font-size:14px}.file-size{font-size:12px;color:#64748B;margin-top:2px}
.btn{display:inline-block;padding:13px 28px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0 20px}
.footer{padding:18px 36px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8}
</style></head>
<body>
<div class="wrap">
  <div class="hdr"><h1>New file from ${d.clientName}</h1></div>
  <div class="body">
    <p>Your client <strong>${d.clientName}</strong> has uploaded a new file to their portal:</p>
    <div class="file-box">
      <div class="file-icon">📎</div>
      <div class="file-info">
        <div class="file-name">${d.fileName}</div>
        <div class="file-size">${d.fileSize}</div>
      </div>
    </div>
    <a href="${d.clientDetailUrl}" class="btn">View client & download file</a>
  </div>
  <div class="footer">${d.firmName} · My Tax Diary</div>
  ${EMAIL_LEGAL_FOOTER_DIV}
</div>
</body></html>`;
}

export function portalFileUploadedPlainText(d: PortalFileUploadedEmailData): string {
  return `New file from ${d.clientName}

File: ${d.fileName} (${d.fileSize})

View client: ${d.clientDetailUrl}`;
}

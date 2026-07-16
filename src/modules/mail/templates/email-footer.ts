const SITE = 'https://mytaxdiary.co.uk';

/**
 * Legal footer row for table-based email templates.
 * Insert immediately before </body></html>.
 */
export const EMAIL_LEGAL_FOOTER = `
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 16px 32px">
    <tr><td align="center">
      <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;max-width:520px">
        My Tax Diary Ltd, Company No. 17312332<br>
        <a href="${SITE}/privacy-policy" style="color:#9ca3af;text-decoration:underline">Privacy Policy</a>
        &nbsp;&middot;&nbsp;
        <a href="${SITE}/terms" style="color:#9ca3af;text-decoration:underline">Terms &amp; Conditions</a>
      </p>
    </td></tr>
  </table>`;

/**
 * Legal footer for div-based email templates (portal emails).
 */
export const EMAIL_LEGAL_FOOTER_DIV = `
  <div style="padding:12px 36px 24px;text-align:center;font-size:11px;color:#94A3B8;line-height:1.7">
    My Tax Diary Ltd, Company No. 17312332<br>
    <a href="${SITE}/privacy-policy" style="color:#94A3B8;text-decoration:underline">Privacy Policy</a>
    &nbsp;&middot;&nbsp;
    <a href="${SITE}/terms" style="color:#94A3B8;text-decoration:underline">Terms &amp; Conditions</a>
  </div>`;

import { registerAs } from '@nestjs/config';

export default registerAs('emailOAuth', () => ({
  /**
   * 64-char hex AES-256-GCM key for mailbox tokens.
   * Falls back to HMRC_ENCRYPTION_KEY when unset.
   */
  encryptionKey: process.env.EMAIL_ENCRYPTION_KEY || process.env.HMRC_ENCRYPTION_KEY,

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/settings/email/callback',
    /** Space-separated OAuth scopes */
    scope:
      process.env.GOOGLE_EMAIL_SCOPE ??
      'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email openid',
  },

  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri:
      process.env.MICROSOFT_REDIRECT_URI ?? 'http://localhost:3000/settings/email/callback',
    tenant: process.env.MICROSOFT_TENANT ?? 'common',
    scope:
      process.env.MICROSOFT_EMAIL_SCOPE ??
      'offline_access openid email https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read',
  },
}));

import { registerAs } from '@nestjs/config';

export default registerAs('hmrc', () => ({
  /** HMRC API base (sandbox: https://test-api.service.hmrc.gov.uk) */
  baseUrl: process.env.HMRC_BASE_URL,
  /** HMRC auth/UI base — different subdomain from the API */
  authBaseUrl: process.env.HMRC_AUTH_BASE_URL,
  clientId: process.env.HMRC_CLIENT_ID,
  clientSecret: process.env.HMRC_CLIENT_SECRET,
  /** Must match exactly what is registered in HMRC Developer Hub */
  redirectUri: process.env.HMRC_REDIRECT_URI,
  scope: process.env.HMRC_SCOPE,
  /**
   * 64-char hex string (32-byte key) for AES-256-GCM token encryption.
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   * Required in production. Optional in sandbox/dev (tokens stored plain if not set).
   */
  encryptionKey: process.env.HMRC_ENCRYPTION_KEY,
}));

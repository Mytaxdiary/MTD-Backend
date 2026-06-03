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
  /** Fraud prevention — WEB_APP_VIA_SERVER vendor headers */
  vendorProductName: process.env.HMRC_VENDOR_PRODUCT_NAME ?? 'NewEffect MTD ITSA',
  vendorVersion: process.env.HMRC_VENDOR_VERSION ?? 'mtd-api=1.0.0&mtd-app=1.0.0',
  vendorPublicIp: process.env.HMRC_VENDOR_PUBLIC_IP,
  vendorLicenseIds: process.env.HMRC_VENDOR_LICENSE_IDS,
  /** Local dev fallback for Gov-Client-Public-Port when the browser cannot detect it */
  devClientPublicPort: process.env.HMRC_DEV_CLIENT_PUBLIC_PORT,
}));

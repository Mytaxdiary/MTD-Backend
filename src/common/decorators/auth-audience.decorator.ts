import { SetMetadata } from '@nestjs/common';

/**
 * JWT audience for protected routes.
 * - `firm` (default): accountant owner/staff only — platform admins are blocked
 * - `admin`: platform product-owner admins only
 * - `any`: either audience (e.g. logout)
 */
export type AuthAudienceType = 'firm' | 'admin' | 'any';

export const AUTH_AUDIENCE_KEY = 'authAudience';

export const AuthAudience = (audience: AuthAudienceType) =>
  SetMetadata(AUTH_AUDIENCE_KEY, audience);

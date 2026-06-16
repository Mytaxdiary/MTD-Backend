/**
 * Auth response types — aligned with the frontend authService.ts shapes:
 *   AuthUser  → { id, name, email, firmName }
 *   AuthResponse → { accessToken, refreshToken, user }
 */

export interface AuthUserResponse {
  id: string;
  /** Full name: firstName + lastName */
  name: string;
  email: string;
  /** Maps from practiceName sent at registration */
  firmName: string;
  isEmailVerified: boolean;
  tenantId: string | null;
  mfaEnabled?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: AuthUserResponse;
  /** True when the user has MFA enabled — full tokens are NOT issued yet. */
  requiresMfa?: boolean;
  /** Short-lived JWT exchanged for full tokens after TOTP verification. */
  mfaToken?: string;
}

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp — when the access JWT expires (for proactive client refresh). */
  accessTokenExpiresAt: string;
}

export interface SessionResponse {
  user: AuthUserResponse;
  accessTokenExpiresAt: string;
  /** True when new cookies were issued (access was expired or near expiry). */
  refreshed: boolean;
}

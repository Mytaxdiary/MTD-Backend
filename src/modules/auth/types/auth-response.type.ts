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
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
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

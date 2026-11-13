import { ConfigService } from '@nestjs/config';

/**
 * Returns JWT_SECRET from config. Throws if missing so we never fall back to a
 * known public/dev secret on misconfiguration.
 */
export function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('auth.jwtSecret')?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required. Set JWT_SECRET in the environment.');
  }
  return secret;
}

/**
 * Returns PORTAL_JWT_SECRET for client-portal tokens only.
 * Kept separate from agent JWT_SECRET so the two trust domains do not share a signing key.
 */
export function requirePortalJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('auth.portalJwtSecret')?.trim();
  if (!secret) {
    throw new Error('PORTAL_JWT_SECRET is required. Set PORTAL_JWT_SECRET in the environment.');
  }
  return secret;
}

import { createHmac } from 'node:crypto';

/**
 * Produces a deterministic HMAC-SHA256 hex digest of `value` keyed by
 * HMRC_ENCRYPTION_KEY. Used for unique-index columns (e.g. NINO) that must
 * remain searchable after encryption with a random IV.
 *
 * Falls back to a simple SHA-256 hash when no key is set (dev only).
 */
export function piiHash(value: string): string {
  const key = process.env.HMRC_ENCRYPTION_KEY ?? 'dev-hash-fallback';
  return createHmac('sha256', key).update(value.toUpperCase()).digest('hex');
}

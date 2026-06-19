import type { ValueTransformer } from 'typeorm';
import { encrypt, decrypt, isEncrypted } from '../../modules/hmrc/crypto.util';

/**
 * TypeORM column transformer that transparently encrypts values on write
 * and decrypts on read using AES-256-GCM.
 *
 * The encryption key is resolved lazily from the process environment so this
 * module can be imported at module-load time before config is fully wired.
 *
 * Falls back to plaintext when HMRC_ENCRYPTION_KEY is not set (dev without .env).
 */
export function piiTransformer(nullable = false): ValueTransformer {
  const getKey = (): string | undefined =>
    process.env.HMRC_ENCRYPTION_KEY;

  return {
    to(value: string | null | undefined): string | null {
      if (value == null) return nullable ? null : '';
      const key = getKey();
      if (!key) return value; // no key → store plaintext (dev fallback)
      return encrypt(value, key);
    },

    from(stored: string | null | undefined): string | null {
      if (stored == null || stored === '') return stored ?? null;
      const key = getKey();
      if (!key) return stored; // no key → return as-is
      if (!isEncrypted(stored)) return stored; // legacy plaintext row
      return decrypt(stored, key);
    },
  };
}

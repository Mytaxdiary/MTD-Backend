import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Hashes a plain-text password using bcryptjs.
 * TODO (auth phase): call this in the auth service register flow.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a bcrypt hash.
 * TODO (auth phase): call this in the auth service login flow.
 */
export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

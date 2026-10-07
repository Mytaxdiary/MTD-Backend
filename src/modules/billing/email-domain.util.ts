/** Email domain helpers for trial abuse prevention. */

const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'gmx.com',
  'gmx.co.uk',
  'yandex.com',
  'yandex.ru',
  'zoho.com',
  'fastmail.com',
  'pm.me',
]);

/** Lowercase domain from email; strips +tag from local part before @. */
export function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

export function isPublicMailDomain(domain: string): boolean {
  return PUBLIC_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}

/** True when this domain should be locked after one trial (corporate / custom). */
export function isCorporateTrialDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes('.')) return false;
  return !isPublicMailDomain(d);
}

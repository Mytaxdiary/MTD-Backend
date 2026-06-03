/** Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4). */
export function normalizeIp(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);
  return trimmed;
}

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

/** True when the address is a routable public IPv4 (HMRC fraud headers). */
export function isPublicIpv4(ip: string): boolean {
  const normalized = normalizeIp(ip);
  const octets = parseIpv4(normalized);
  if (!octets) return false;

  const [a, b] = octets;
  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 0) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a >= 224) return false;
  return true;
}

export function isValidPublicPort(port: string): boolean {
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

/** HMRC expects key=value pairs separated by &. */
export function formatVendorLicenseIds(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  if (trimmed.includes('=')) {
    const pairs = trimmed.split('&').every((part) => /^[^=]+=.+$/.test(part.trim()));
    return pairs ? trimmed : undefined;
  }
  return `mtd-itsa=${encodeURIComponent(trimmed)}`;
}

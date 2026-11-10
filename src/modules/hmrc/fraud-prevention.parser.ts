import type { Request } from 'express';
import type {
  FraudPreventionClientPayload,
  HmrcFraudRequestContext,
} from './fraud-prevention.types';
import { isPublicIpv4, isValidPublicPort, normalizeIp } from './fraud-prevention.ip.util';

const FRAUD_HEADER = 'x-hmrc-fraud-context';
/** Set by nginx: proxy_set_header X-Client-Source-Port $remote_port; */
const CLIENT_SOURCE_PORT_HEADER = 'x-client-source-port';

function decodeBase64Json(raw: string): FraudPreventionClientPayload | null {
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as FraudPreventionClientPayload;
    if (!parsed?.deviceId || !parsed?.userAgent) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseFraudClientPayload(req: Request): FraudPreventionClientPayload | null {
  const raw = req.headers[FRAUD_HEADER];
  if (!raw || typeof raw !== 'string') return null;
  return decodeBase64Json(raw);
}

export function resolveClientIp(
  req: Request,
  client: FraudPreventionClientPayload | null,
): string | undefined {
  const candidates: string[] = [];
  if (client?.publicIp) candidates.push(client.publicIp);

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    candidates.push(forwarded.split(',')[0].trim());
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) {
    candidates.push(realIp);
  }

  const socketIp = req.ip || req.socket?.remoteAddress;
  if (socketIp) candidates.push(socketIp);

  for (const raw of candidates) {
    const ip = normalizeIp(raw);
    if (isPublicIpv4(ip)) return ip;
  }

  return undefined;
}

/**
 * Real client TCP source port for Gov-Client-Public-Port.
 * Prefer nginx-forwarded $remote_port; fall back to the inbound socket when
 * the client hits Nest directly (local/dev without a reverse proxy).
 */
export function resolveClientSourcePort(req: Request): string | undefined {
  const headerRaw = req.headers[CLIENT_SOURCE_PORT_HEADER];
  const headerPort = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  if (typeof headerPort === 'string' && isValidPublicPort(headerPort.trim())) {
    return headerPort.trim();
  }

  const socketPort = req.socket?.remotePort;
  if (typeof socketPort === 'number' && isValidPublicPort(String(socketPort))) {
    return String(socketPort);
  }

  return undefined;
}

export function buildHmrcFraudRequestContext(
  req: Request,
  userEmail: string,
  loginAt?: number,
  mfaAuthenticated?: boolean,
): HmrcFraudRequestContext {
  const client = parseFraudClientPayload(req);
  return {
    client,
    userEmail,
    clientPublicIp: resolveClientIp(req, client),
    // Server-captured port only — do not trust browser/env publicPort here.
    clientPublicPort: resolveClientSourcePort(req),
    loginAt,
    mfaAuthenticated: mfaAuthenticated ?? false,
  };
}

import type { Request } from 'express';
import type { FraudPreventionClientPayload, HmrcFraudRequestContext } from './fraud-prevention.types';
import { isPublicIpv4, normalizeIp } from './fraud-prevention.ip.util';

const FRAUD_HEADER = 'x-hmrc-fraud-context';

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
    clientPublicPort: client?.publicPort,
    loginAt,
    mfaAuthenticated: mfaAuthenticated ?? false,
  };
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  FraudPreventionClientPayload,
  HmrcFraudRequestContext,
} from './fraud-prevention.types';
import { isPublicIpv4, isValidPublicPort, normalizeIp } from './fraud-prevention.ip.util';

const CONNECTION_METHOD = 'WEB_APP_VIA_SERVER';
/** Spec example port — never send this. */
const BANNED_EXAMPLE_PORTS = new Set(['12345']);

function pct(value: string): string {
  return encodeURIComponent(value);
}

function formatScreens(screens: FraudPreventionClientPayload['screens']): string {
  return screens
    .map(
      (s) =>
        `width=${s.width}&height=${s.height}&scaling-factor=${s.scalingFactor}&colour-depth=${s.colourDepth}`,
    )
    .join(',');
}

/** Window must not exceed primary screen (HMRC cross-check). */
export function clampWindowToScreens(
  windowWidth: number,
  windowHeight: number,
  screens: FraudPreventionClientPayload['screens'],
): { width: number; height: number } {
  const primary = screens?.[0];
  const maxW = primary?.width && primary.width > 0 ? primary.width : windowWidth;
  const maxH = primary?.height && primary.height > 0 ? primary.height : windowHeight;
  return {
    width: Math.max(1, Math.min(Math.floor(windowWidth), maxW)),
    height: Math.max(1, Math.min(Math.floor(windowHeight), maxH)),
  };
}

function formatPublicIpTimestamp(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}Z`
  );
}

function resolvePublicClientIp(ctx: HmrcFraudRequestContext): string | undefined {
  const candidates = [ctx.client?.publicIp, ctx.clientPublicIp].filter(Boolean) as string[];
  for (const raw of candidates) {
    const ip = normalizeIp(raw);
    if (isPublicIpv4(ip)) return ip;
  }
  return undefined;
}

function resolveClientPort(ctx: HmrcFraudRequestContext, devFallback?: string): string | undefined {
  const candidates = [ctx.clientPublicPort, ctx.client?.publicPort, devFallback].filter(
    Boolean,
  ) as string[];
  for (const port of candidates) {
    if (BANNED_EXAMPLE_PORTS.has(port)) continue;
    if (isValidPublicPort(port)) return port;
  }
  return undefined;
}

@Injectable()
export class HmrcFraudHeadersBuilder {
  constructor(private readonly configService: ConfigService) {}

  /** Builds Gov-* HTTP headers for WEB_APP_VIA_SERVER. */
  build(ctx: HmrcFraudRequestContext): Record<string, string> {
    const headers: Record<string, string> = {
      'Gov-Client-Connection-Method': CONNECTION_METHOD,
    };

    const productName = this.configService.get<string>('hmrc.vendorProductName') ?? 'My Tax Diary';
    headers['Gov-Vendor-Product-Name'] = pct(productName);

    const vendorVersion =
      this.configService.get<string>('hmrc.vendorVersion') ?? 'mtd-api=1.0.0&mtd-app=1.0.0';
    headers['Gov-Vendor-Version'] = vendorVersion;

    // HMRC SDS: omit Gov-Vendor-License-IDs — we do not collect license keys on device.

    const vendorPublicIpRaw = this.configService.get<string>('hmrc.vendorPublicIp');
    const vendorPublicIp =
      vendorPublicIpRaw && isPublicIpv4(normalizeIp(vendorPublicIpRaw))
        ? normalizeIp(vendorPublicIpRaw)
        : undefined;
    if (vendorPublicIp) {
      headers['Gov-Vendor-Public-IP'] = vendorPublicIp;
    }

    const client = ctx.client;
    if (client) {
      const window = clampWindowToScreens(client.windowWidth, client.windowHeight, client.screens);
      headers['Gov-Client-Browser-JS-User-Agent'] = client.userAgent;
      headers['Gov-Client-Device-ID'] = client.deviceId;
      headers['Gov-Client-Timezone'] = client.timezone;
      headers['Gov-Client-Screens'] = formatScreens(client.screens);
      headers['Gov-Client-Window-Size'] = `width=${window.width}&height=${window.height}`;
      headers['Gov-Client-User-IDs'] = `my-application=${pct(ctx.userEmail)}`;

      const clientIp = resolvePublicClientIp(ctx);
      if (clientIp) {
        headers['Gov-Client-Public-IP'] = clientIp;
        headers['Gov-Client-Public-IP-Timestamp'] = formatPublicIpTimestamp(
          client.publicIpTimestamp,
        );

        const clientPort = resolveClientPort(
          ctx,
          this.configService.get<string>('hmrc.devClientPublicPort'),
        );
        if (clientPort) {
          headers['Gov-Client-Public-Port'] = clientPort;
        }

        if (vendorPublicIp) {
          headers['Gov-Vendor-Forwarded'] = `by=${pct(vendorPublicIp)}&for=${pct(clientIp)}`;
        }
      }
    } else if (ctx.userEmail) {
      headers['Gov-Client-User-IDs'] = `my-application=${pct(ctx.userEmail)}`;
    }

    // Gov-Client-Multi-Factor — only when TOTP was used this session (HMRC: omit otherwise).
    if (ctx.mfaAuthenticated) {
      const loginTimestamp = pct(
        ctx.loginAt ? new Date(ctx.loginAt * 1000).toISOString() : new Date().toISOString(),
      );
      const uniqueRef = ctx.userEmail
        ? pct(`${ctx.userEmail.slice(0, 8)}_${ctx.loginAt ?? Date.now()}`)
        : pct(`session_${Date.now()}`);

      headers['Gov-Client-Multi-Factor'] =
        `type=TOTP&timestamp=${loginTimestamp}&unique-reference=${uniqueRef}`;
    }

    return headers;
  }
}

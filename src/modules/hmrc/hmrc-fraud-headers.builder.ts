import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  FraudPreventionClientPayload,
  HmrcFraudRequestContext,
} from './fraud-prevention.types';
import {
  formatVendorLicenseIds,
  isPublicIpv4,
  isValidPublicPort,
  normalizeIp,
} from './fraud-prevention.ip.util';

const CONNECTION_METHOD = 'WEB_APP_VIA_SERVER';

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

function resolveClientPort(
  ctx: HmrcFraudRequestContext,
  devFallback?: string,
): string | undefined {
  const port = ctx.clientPublicPort ?? ctx.client?.publicPort;
  if (port && isValidPublicPort(port)) return port;
  if (devFallback && isValidPublicPort(devFallback)) return devFallback;
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

    const productName =
      this.configService.get<string>('hmrc.vendorProductName') ?? 'NewEffect MTD ITSA';
    headers['Gov-Vendor-Product-Name'] = pct(productName);

    const vendorVersion =
      this.configService.get<string>('hmrc.vendorVersion') ?? 'mtd-api=1.0.0&mtd-app=1.0.0';
    headers['Gov-Vendor-Version'] = vendorVersion;

    const licenseIds = formatVendorLicenseIds(
      this.configService.get<string>('hmrc.vendorLicenseIds'),
    );
    if (licenseIds) {
      headers['Gov-Vendor-License-IDs'] = licenseIds;
    }

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
      headers['Gov-Client-Browser-JS-User-Agent'] = client.userAgent;
      headers['Gov-Client-Device-ID'] = client.deviceId;
      headers['Gov-Client-Timezone'] = client.timezone;
      headers['Gov-Client-Screens'] = formatScreens(client.screens);
      headers['Gov-Client-Window-Size'] = `width=${client.windowWidth}&height=${client.windowHeight}`;
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

    // Gov-Client-Multi-Factor — always include PASSWORD; add TOTP when MFA was used
    const loginTimestamp = ctx.loginAt
      ? new Date(ctx.loginAt * 1000).toISOString()
      : new Date().toISOString();
    const uniqueRef = ctx.userEmail
      ? pct(`${ctx.userEmail.slice(0, 8)}_${ctx.loginAt ?? Date.now()}`)
      : pct(`session_${Date.now()}`);

    const factors: string[] = [
      `type=PASSWORD&timestamp=${loginTimestamp}&uniqueRef=${uniqueRef}`,
    ];
    if (ctx.mfaAuthenticated) {
      factors.push(
        `type=SOFTWARE_TOTP_TOKEN&timestamp=${loginTimestamp}&uniqueRef=${uniqueRef}_totp`,
      );
    }
    headers['Gov-Client-Multi-Factor'] = factors.join(',');

    return headers;
  }
}

import * as tls from 'tls';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HmrcFraudHeadersBuilder } from './hmrc-fraud-headers.builder';
import type { HmrcFraudRequestContext } from './fraud-prevention.types';
import { retryWithBackoff, type RetryOptions } from './hmrc-retry.util';

/**
 * Verify at module load time that the Node.js runtime enforces TLS 1.2 or
 * above for all outbound HTTPS connections.  This satisfies HMRC's requirement
 * that integrations "must support TLS 1.2 or above" and makes the enforcement
 * explicit, auditable, and discoverable in code review.
 *
 * Node.js 18+ already defaults to TLSv1.2, so this assertion should never
 * throw in practice — it exists as a hard guard against misconfigured runtimes.
 */
const TLS_ORDER = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'] as const;
const currentMin = tls.DEFAULT_MIN_VERSION ?? 'TLSv1';
if (TLS_ORDER.indexOf(currentMin as typeof TLS_ORDER[number]) < TLS_ORDER.indexOf('TLSv1.2')) {
  throw new Error(
    `[HmrcApiClient] TLS minimum version is ${currentMin} — TLSv1.2 or above is required for HMRC API compliance.`,
  );
}

/**
 * HMRC vendor MIME type prefix.
 * All HMRC API resources are versioned via the Accept header:
 *   Accept: application/vnd.hmrc.{version}+json
 * Using the plain "application/json" fallback causes HMRC to either reject
 * the request (406) or respond with an unspecified API version.
 */
const HMRC_ACCEPT_DEFAULT = 'application/vnd.hmrc.1.0+json';

export interface HmrcFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  accessToken?: string;
  fraudContext?: HmrcFraudRequestContext | null;
  /** Override retry behaviour — pass `{ maxRetries: 0 }` to disable. */
  retry?: RetryOptions;
}

@Injectable()
export class HmrcApiClient implements OnModuleInit {
  private readonly logger = new Logger(HmrcApiClient.name);

  constructor(private readonly fraudHeadersBuilder: HmrcFraudHeadersBuilder) {}

  onModuleInit() {
    this.logger.log(
      `TLS minimum version enforced: ${tls.DEFAULT_MIN_VERSION} (satisfies HMRC TLS 1.2+ requirement)`,
    );
  }

  async fetch(url: string, options: HmrcFetchOptions = {}): Promise<Response> {
    const { accessToken, fraudContext, headers: extraHeaders, retry, ...init } = options;

    const headers: Record<string, string> = {
      // Default to versioned HMRC vendor MIME type (callers override per endpoint)
      Accept: HMRC_ACCEPT_DEFAULT,
      ...(fraudContext ? this.fraudHeadersBuilder.build(fraudContext) : {}),
      ...(extraHeaders ?? {}),
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return retryWithBackoff(() => fetch(url, { ...init, headers }), retry);
  }
}

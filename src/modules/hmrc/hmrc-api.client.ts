import * as tls from 'tls';
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
if (TLS_ORDER.indexOf(currentMin as (typeof TLS_ORDER)[number]) < TLS_ORDER.indexOf('TLSv1.2')) {
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
  /**
   * Only for non-MTD helpers (e.g. validation-feedback) that must not invent
   * client device headers. Default false = refuse bare HMRC calls.
   */
  skipFraudHeaders?: boolean;
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
    const {
      accessToken,
      fraudContext,
      skipFraudHeaders = false,
      headers: extraHeaders,
      retry,
      ...init
    } = options;

    const headers: Record<string, string> = {
      Accept: HMRC_ACCEPT_DEFAULT,
      ...(extraHeaders ?? {}),
    };

    if (!skipFraudHeaders) {
      this.assertFraudContext(fraudContext, url);
      Object.assign(headers, this.fraudHeadersBuilder.build(fraudContext!));
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return retryWithBackoff(() => fetch(url, { ...init, headers }), retry);
  }

  /**
   * Fail closed: never call MTD APIs without browser-collected client fields.
   * Missing X-Hmrc-Fraud-Context was the root cause of HMRC "Header required"
   * findings (Connection-Method / Device-ID / Timezone / User-IDs / vendor).
   */
  private assertFraudContext(
    fraudContext: HmrcFraudRequestContext | null | undefined,
    url: string,
  ): void {
    if (!fraudContext) {
      this.logger.error(`Refusing HMRC call without fraudContext: ${url}`);
      throw new BadRequestException(
        'Browser fraud prevention data is required for HMRC API calls. Refresh the page and try again.',
      );
    }
    const client = fraudContext.client;
    if (!client?.deviceId || !client.userAgent || !client.timezone) {
      this.logger.error(`Refusing HMRC call with incomplete fraud client payload: ${url}`);
      throw new BadRequestException(
        'Incomplete browser fraud prevention data. Refresh the page and try again.',
      );
    }
    if (!fraudContext.userEmail?.trim()) {
      this.logger.error(`Refusing HMRC call without userEmail for Gov-Client-User-IDs: ${url}`);
      throw new BadRequestException(
        'Signed-in user identity is required for HMRC fraud prevention headers.',
      );
    }
  }
}

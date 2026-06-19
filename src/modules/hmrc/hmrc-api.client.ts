import { Injectable } from '@nestjs/common';
import { HmrcFraudHeadersBuilder } from './hmrc-fraud-headers.builder';
import type { HmrcFraudRequestContext } from './fraud-prevention.types';
import { retryWithBackoff, type RetryOptions } from './hmrc-retry.util';

export interface HmrcFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  accessToken?: string;
  fraudContext?: HmrcFraudRequestContext | null;
  /** Override retry behaviour — pass `{ maxRetries: 0 }` to disable. */
  retry?: RetryOptions;
}

@Injectable()
export class HmrcApiClient {
  constructor(private readonly fraudHeadersBuilder: HmrcFraudHeadersBuilder) {}

  async fetch(url: string, options: HmrcFetchOptions = {}): Promise<Response> {
    const { accessToken, fraudContext, headers: extraHeaders, retry, ...init } = options;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(fraudContext ? this.fraudHeadersBuilder.build(fraudContext) : {}),
      ...(extraHeaders ?? {}),
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return retryWithBackoff(() => fetch(url, { ...init, headers }), retry);
  }
}

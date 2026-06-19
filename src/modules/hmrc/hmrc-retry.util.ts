/**
 * Retries an async function that returns a `Response` when HMRC responds with
 * 429 (Too Many Requests) or 503 (Service Unavailable).
 *
 * Back-off strategy:
 *  1. Honour the `Retry-After` response header (seconds) when present.
 *  2. Otherwise use exponential back-off with full jitter:
 *       delay = random(0, baseMs * 2^attempt)   capped at maxDelayMs
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in ms for exponential back-off (default: 1 000 ms). */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 30 000 ms). */
  maxDelayMs?: number;
}

const DEFAULT_OPTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveDelay(response: Response, attempt: number, opts: Required<RetryOptions>): number {
  const retryAfterHeader = response.headers.get('Retry-After');
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1_000, opts.maxDelayMs);
    }
  }
  // Exponential back-off with full jitter: random(0, base * 2^attempt)
  const ceiling = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
  return Math.random() * ceiling;
}

const RETRYABLE_STATUSES = new Set([429, 503]);

/**
 * Executes `fn` and retries on 429/503 responses.
 *
 * @param fn    Factory that initiates the fetch — called again on each retry.
 * @param opts  Optional retry configuration.
 * @returns     The first non-retryable `Response`.
 */
export async function retryWithBackoff(
  fn: () => Promise<Response>,
  opts: RetryOptions = {},
): Promise<Response> {
  const config = { ...DEFAULT_OPTS, ...opts };

  let attempt = 0;
  while (true) {
    const response = await fn();

    if (!RETRYABLE_STATUSES.has(response.status) || attempt >= config.maxRetries) {
      return response;
    }

    const delay = resolveDelay(response, attempt, config);
    await sleep(delay);
    attempt++;
  }
}

import type {
  FraudPreventionFeedbackResult,
  FraudPreventionValidationResult,
} from './fraud-prevention.types';

export interface FraudValidationSummary {
  valid: boolean;
  hasWarnings: boolean;
  warningHeaders: string[];
}

export interface FraudFeedbackSummary {
  valid: boolean;
  requestCount: number;
  invalidCount: number;
  warningCount: number;
  detail: string;
}

/** Maps HMRC validator response to app-friendly pass/fail (warnings-only = pass). */
export function summarizeFraudValidation(
  result: FraudPreventionValidationResult,
): FraudValidationSummary {
  const hasErrors = Array.isArray(result.errors) && result.errors.length > 0;
  const warningHeaders = extractWarningHeaders(result.warnings);

  const valid =
    !hasErrors &&
    (result.code === 'VALID_HEADERS' ||
      result.code === 'POTENTIALLY_INVALID_HEADERS' ||
      (Array.isArray(result.headers) &&
        result.headers.every((h) => !h.errors || h.errors.length === 0)));

  return {
    valid,
    hasWarnings: warningHeaders.length > 0,
    warningHeaders,
  };
}

/** Summarises validation-feedback for the last request to each endpoint of an API. */
export function summarizeFraudFeedback(
  result: FraudPreventionFeedbackResult,
): FraudFeedbackSummary {
  const requests = Array.isArray(result.requests) ? result.requests : [];
  let invalidCount = 0;
  let warningCount = 0;
  const lines: string[] = [];

  for (const req of requests) {
    const code = req.code ?? 'UNKNOWN';
    const label = `${req.method ?? '?'} ${req.path ?? '?'}`;
    if (code === 'INVALID_HEADERS') {
      invalidCount += 1;
      lines.push(`${label}: INVALID`);
    } else if (code === 'POTENTIALLY_INVALID_HEADERS') {
      warningCount += 1;
      lines.push(`${label}: warnings`);
    } else if (code === 'VALID_HEADERS') {
      lines.push(`${label}: OK`);
    } else {
      lines.push(`${label}: ${code}`);
    }
  }

  return {
    valid: invalidCount === 0 && requests.length > 0,
    requestCount: requests.length,
    invalidCount,
    warningCount,
    detail:
      requests.length === 0
        ? 'No recent sandbox requests found for this API. Call it from the app first, then check again.'
        : lines.slice(0, 12).join('\n'),
  };
}

function extractWarningHeaders(warnings: unknown): string[] {
  if (!Array.isArray(warnings)) return [];
  const headers: string[] = [];
  for (const w of warnings) {
    if (w && typeof w === 'object' && 'headers' in w && Array.isArray(w.headers)) {
      headers.push(...(w.headers as string[]));
    }
  }
  return [...new Set(headers)];
}

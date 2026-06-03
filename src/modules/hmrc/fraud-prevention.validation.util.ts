import type { FraudPreventionValidationResult } from './fraud-prevention.types';

export interface FraudValidationSummary {
  valid: boolean;
  hasWarnings: boolean;
  warningHeaders: string[];
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

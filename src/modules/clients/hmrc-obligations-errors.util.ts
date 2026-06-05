import { parseHmrcErrorJson } from './hmrc-invitation-errors.util';

/** Maps HMRC Obligations API errors to user-facing messages. */
export function obligationsErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'NO_OBLIGATIONS_FOUND') {
    return 'HMRC found no obligations for this client and the selected filters.';
  }

  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || code === 'NOT_FOUND' || httpStatus === 404) {
    return (
      'HMRC could not find obligations for this client. ' +
      'Check the NINO, business, and date range.'
    );
  }

  if (code === 'FORMAT_NINO' || code === 'FORMAT_BUSINESS_ID') {
    return parsed?.message ?? 'Invalid NINO or business ID for HMRC obligations.';
  }

  if (code === 'RESOURCE_FORBIDDEN' || httpStatus === 403) {
    return (
      'HMRC rejected this request. Reconnect HMRC in Settings and ensure your app is subscribed to ' +
      'Obligations (MTD) v3.0 with read:self-assessment scope.'
    );
  }

  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }

  if (httpStatus === 400) {
    return parsed?.message ?? 'Invalid request to HMRC Obligations API.';
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }

  return parsed?.message ?? 'Failed to retrieve obligations from HMRC.';
}

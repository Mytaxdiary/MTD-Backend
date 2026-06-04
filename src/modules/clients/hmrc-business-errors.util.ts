import { parseHmrcErrorJson } from './hmrc-invitation-errors.util';

/** Maps HMRC Business Details API errors to user-facing messages. */
export function businessErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || code === 'NOT_FOUND' || httpStatus === 404) {
    return (
      'HMRC could not find business income sources for this client. ' +
      'The client may have no MTD businesses registered, or the business ID may be invalid.'
    );
  }

  if (code === 'FORMAT_NINO') {
    return 'The client NINO format is invalid for HMRC.';
  }

  if (code === 'FORMAT_BUSINESS_ID') {
    return 'The business ID format is invalid.';
  }

  if (code === 'RESOURCE_FORBIDDEN' || httpStatus === 403) {
    return (
      'HMRC rejected this request. Reconnect HMRC in Settings and ensure your app is subscribed to ' +
      'Business Details (MTD) v2.0 with read:self-assessment scope.'
    );
  }

  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }

  if (httpStatus === 400) {
    return parsed?.message ?? 'Invalid request to HMRC Business Details API.';
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }

  return parsed?.message ?? 'Failed to retrieve business details from HMRC.';
}

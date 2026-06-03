import { parseHmrcErrorJson } from './hmrc-invitation-errors.util';

/** Maps HMRC ITSA Status API errors to user-facing messages. */
export function itsaErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || httpStatus === 404) {
    return (
      'HMRC could not find ITSA status for this client and tax year. ' +
      'Check the NINO, tax year format (e.g. 2024-25), and that the client is MTD enrolled.'
    );
  }

  if (code === 'NOT_FOUND') {
    return 'No ITSA status data found for this client and tax year.';
  }

  if (code === 'NOT_ENROLLED') {
    return 'This client is not enrolled for Making Tax Digital with HMRC.';
  }

  if (code === 'RESOURCE_FORBIDDEN' || httpStatus === 403) {
    return (
      'HMRC rejected this request. Reconnect HMRC in Settings and ensure your app is subscribed to ' +
      'Self Assessment Individual Details (MTD) v2.0 with read:self-assessment scope.'
    );
  }

  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }

  if (httpStatus === 400) {
    return parsed?.message ?? 'Invalid request to HMRC ITSA Status API. Check the tax year format.';
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }

  return parsed?.message ?? 'Failed to retrieve ITSA status from HMRC.';
}

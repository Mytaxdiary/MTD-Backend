import { parseHmrcErrorJson } from './hmrc-invitation-errors.util';

/** Maps HMRC Self Assessment Accounts API errors to user-facing messages. */
export function accountsErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || code === 'NOT_FOUND' || httpStatus === 404) {
    return (
      'HMRC could not find account balance or transactions for this client. ' +
      'Check the NINO and date range.'
    );
  }

  if (code === 'INVALID_DATE_RANGE') {
    return 'The date range for HMRC account transactions is invalid (maximum 732 days).';
  }

  if (code === 'FORMAT_NINO') {
    return 'The client NINO format is invalid for HMRC.';
  }

  if (code === 'RESOURCE_FORBIDDEN' || httpStatus === 403) {
    return (
      'HMRC rejected this request. Reconnect HMRC in Settings and ensure your app is subscribed to ' +
      'Self Assessment Accounts (MTD) v4.0 with read:self-assessment scope.'
    );
  }

  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }

  if (httpStatus === 400) {
    return parsed?.message ?? 'Invalid request to HMRC Self Assessment Accounts API.';
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }

  return parsed?.message ?? 'Failed to retrieve account balance and transactions from HMRC.';
}

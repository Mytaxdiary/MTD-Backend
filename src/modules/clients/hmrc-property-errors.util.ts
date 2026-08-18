import { parseHmrcErrorJson } from './hmrc-invitation-errors.util';

/** Maps HMRC Property Business API errors to user-facing messages. */
export function propertyErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || code === 'NOT_FOUND' || httpStatus === 404) {
    return 'HMRC has no UK property figures for this business and tax year yet.';
  }

  if (code === 'TAX_YEAR_NOT_SUPPORTED') {
    return 'This tax year is not supported for UK property figures.';
  }

  if (code === 'RESOURCE_FORBIDDEN' || httpStatus === 403) {
    return (
      'HMRC rejected this request. In Developer Hub, subscribe the sandbox app to ' +
      'Property Business (MTD) and reconnect HMRC if needed.'
    );
  }

  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }

  if (httpStatus === 400) {
    return parsed?.message ?? 'Invalid request to HMRC Property Business API.';
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }

  return parsed?.message ?? 'Failed to retrieve UK property figures from HMRC.';
}

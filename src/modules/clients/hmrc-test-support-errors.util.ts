import { parseHmrcErrorJson } from './hmrc-invitation-errors.util';

/** Maps HMRC Self Assessment Test Support (create business) errors. */
export function testSupportBusinessErrorToUserMessage(
  httpStatus: number,
  responseText: string,
): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'RULE_PROPERTY_BUSINESS_ADDED') {
    return 'This client already has a UK property income source in HMRC sandbox.';
  }

  if (code === 'RULE_UNEXPECTED_BUSINESS_ADDRESS' || code === 'RULE_UNEXPECTED_TRADING_NAME') {
    return 'HMRC rejected the property business payload. Property sources cannot include a trading name or address.';
  }

  if (code === 'RULE_COMMENCEMENT_DATE_NOT_SUPPORTED' || code === 'FORMAT_DATE') {
    return 'HMRC rejected the commencement or accounting period dates for this test business.';
  }

  if (code === 'CLIENT_OR_AGENT_NOT_AUTHORISED' || httpStatus === 403) {
    return (
      'HMRC rejected this request. In Developer Hub, subscribe the sandbox app to ' +
      'Self Assessment Test Support (MTD), add write:self-assessment, then reconnect HMRC.'
    );
  }

  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }

  if (httpStatus === 400) {
    return parsed?.message ?? 'HMRC could not create a UK property test business.';
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }

  return parsed?.message ?? 'Failed to create a sandbox UK property business.';
}

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

/** Maps HMRC charge-history errors to user-facing messages. */
export function chargeHistoryErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || code === 'NOT_FOUND' || httpStatus === 404) {
    return 'HMRC could not find charge history for this item.';
  }

  if (code === 'FORMAT_TAX_TRANSACTION_ID' || code === 'FORMAT_CHARGE_REFERENCE') {
    return 'This charge identifier is not in the format HMRC expects.';
  }

  return accountsErrorToUserMessage(httpStatus, responseText);
}

/** Maps Coding Out / Coding Out Status / ITSA Penalties errors. */
export function codingOutErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || code === 'NOT_FOUND' || httpStatus === 404) {
    return 'HMRC has no coding out or penalties data for this client and tax year.';
  }

  if (code === 'FORMAT_TAX_YEAR') {
    return 'Tax year must be in the format YYYY-YY (for example 2024-25).';
  }

  if (code === 'RULE_TAX_YEAR_NOT_SUPPORTED') {
    return 'HMRC does not support coding out for this tax year.';
  }

  if (code === 'RULE_OUTSIDE_AMENDMENT_WINDOW') {
    return 'This coding out change is outside the HMRC amendment window for the tax year.';
  }

  if (code === 'RULE_ALREADY_OPTED_OUT') {
    return 'This client is already opted out of coding out for the selected tax year.';
  }

  if (code === 'RULE_ALREADY_OPTED_IN') {
    return 'This client is already opted in to coding out for the selected tax year.';
  }

  if (code === 'RULE_BUSINESS_PARTNER_NOT_EXIST') {
    return 'HMRC does not have a business partner record for this NINO.';
  }

  if (code === 'RULE_ITSA_CONTRACT_OBJECT_NOT_EXIST') {
    return 'HMRC does not have an ITSA contract for this NINO.';
  }

  if (code === 'RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED') {
    return (
      'HMRC rejected the coding out body. Each amount needs both an id and amount, ' +
      'wrapped in taxCodeComponents. inYearAdjustment must be a single object, not an array.'
    );
  }

  if (code === 'RULE_INCORRECT_GOV_TEST_SCENARIO') {
    return 'Sandbox Gov-Test-Scenario value is not valid for this endpoint.';
  }

  if (code === 'RESOURCE_FORBIDDEN' || httpStatus === 403) {
    return (
      'HMRC rejected this request. Reconnect HMRC and ensure write:self-assessment scope ' +
      'is granted for coding out changes.'
    );
  }

  return accountsErrorToUserMessage(httpStatus, responseText);
}

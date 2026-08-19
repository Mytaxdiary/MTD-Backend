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

/** Maps HMRC Property Business cumulative PUT/GET errors. */
export function propertyCumulativeErrorToUserMessage(
  httpStatus: number,
  responseText: string,
): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'RULE_BOTH_EXPENSES_SUPPLIED') {
    return 'HMRC rejected the submission: send either itemised expenses or consolidatedExpenses, not both.';
  }
  if (code === 'RULE_TAX_YEAR_NOT_SUPPORTED' || code === 'TAX_YEAR_NOT_SUPPORTED') {
    return 'This tax year is not supported for UK property cumulative submit. Use 2025-26 or later.';
  }
  if (code === 'RULE_EARLY_DATA_SUBMISSION_NOT_ACCEPTED') {
    return 'HMRC will not accept this period yet. You cannot submit more than 10 days before the period end date.';
  }
  if (code === 'RULE_END_DATE_NOT_ALIGNED_WITH_REPORTING_TYPE') {
    return 'The period end date does not match the quarterly reporting dates HMRC expects.';
  }
  if (code === 'RULE_START_DATE_NOT_ALIGNED_WITH_REPORTING_TYPE') {
    return 'The period start date does not match the quarterly reporting dates HMRC expects.';
  }
  if (code === 'RULE_START_DATE_NOT_ALIGNED_TO_COMMENCEMENT_DATE') {
    return 'The period start date must align with the business commencement date.';
  }
  if (code === 'RULE_MISSING_SUBMISSION_DATES') {
    return 'HMRC requires period start and end dates for this submission.';
  }
  if (code === 'RULE_OUTSIDE_AMENDMENT_WINDOW') {
    return 'This submission is outside the HMRC amendment window.';
  }
  if (code === 'RULE_SUBMISSION_END_DATE_CANNOT_MOVE_BACKWARDS') {
    return 'The period end date cannot be earlier than the last submitted end date.';
  }
  if (code === 'RULE_TO_DATE_BEFORE_FROM_DATE') {
    return 'The period end date must be on or after the start date.';
  }
  if (
    code === 'CLIENT_OR_AGENT_NOT_AUTHORISED' ||
    code === 'RESOURCE_FORBIDDEN' ||
    httpStatus === 403
  ) {
    return (
      'HMRC rejected this request. Reconnect HMRC and ensure write:self-assessment is granted, ' +
      'and the sandbox app is subscribed to Property Business (MTD).'
    );
  }
  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || code === 'NOT_FOUND' || httpStatus === 404) {
    return 'HMRC has no UK property cumulative summary for this business and tax year yet.';
  }
  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }
  if (httpStatus === 400) {
    return parsed?.message ?? 'HMRC rejected the UK property cumulative submission.';
  }
  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }
  return parsed?.message ?? 'Failed to submit UK property cumulative figures to HMRC.';
}

import { parseHmrcErrorJson } from './hmrc-invitation-errors.util';

/** Maps HMRC Self-Employment Business cumulative PUT/GET errors. */
export function seCumulativeErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'RULE_BOTH_EXPENSES_SUPPLIED') {
    return 'HMRC rejected the submission: send either itemised expenses or consolidatedExpenses, not both.';
  }
  if (code === 'RULE_TAX_YEAR_NOT_SUPPORTED' || code === 'TAX_YEAR_NOT_SUPPORTED') {
    return 'This tax year is not supported for self-employment cumulative submit. Use 2025-26 or later.';
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
  if (code === 'CLIENT_OR_AGENT_NOT_AUTHORISED' || httpStatus === 403) {
    return (
      'HMRC rejected this request. Reconnect HMRC and ensure write:self-assessment is granted, ' +
      'and the sandbox app is subscribed to Self-Employment Business (MTD).'
    );
  }
  if (code === 'MATCHING_RESOURCE_NOT_FOUND' || httpStatus === 404) {
    return 'HMRC has no self-employment cumulative summary for this business and tax year yet.';
  }
  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }
  if (httpStatus === 400) {
    return parsed?.message ?? 'HMRC rejected the self-employment cumulative submission.';
  }
  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }
  return parsed?.message ?? 'Failed to submit self-employment cumulative figures to HMRC.';
}

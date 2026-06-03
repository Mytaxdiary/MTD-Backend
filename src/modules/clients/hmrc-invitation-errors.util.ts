/** Parsed HMRC error JSON body (Agent Authorisation API). */
interface HmrcErrorBody {
  code?: string;
  message?: string;
}

export function parseHmrcErrorJson(text: string): HmrcErrorBody | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as HmrcErrorBody;
  } catch {
    return null;
  }
}

/**
 * Maps HMRC invitation API failures to user-facing messages.
 * Full technical detail should only be logged server-side.
 */
export function invitationErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'NO_PERMISSION_ON_AGENCY') {
    return (
      'The Agent Reference Number (ARN) in Settings does not match your HMRC connection. ' +
      'Go to Settings → HMRC Connection, correct your ARN, then try sending the invitation again.'
    );
  }

  if (code === 'CLIENT_REGISTRATION_NOT_FOUND' || code === 'CLIENT_NOT_FOUND') {
    return (
      'HMRC could not find a client matching this NINO and postcode. ' +
      'Check the details and try again.'
    );
  }

  if (code === 'DUPLICATE_AUTHORISATION_REQUEST') {
    return 'An invitation for this client is already pending with HMRC. Check invitation status before resending.';
  }

  if (httpStatus === 401) {
    return (
      'Your HMRC connection has expired or is invalid. ' +
      'Go to Settings → HMRC Connection, disconnect, reconnect, then try again.'
    );
  }

  if (httpStatus === 403) {
    return (
      'HMRC rejected this invitation. Check that your ARN in Settings matches the agent account ' +
      'you used when connecting to HMRC.'
    );
  }

  if (httpStatus === 400 && parsed?.message) {
    return `HMRC could not create the invitation: ${parsed.message}`;
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. The client was saved — please try sending the invitation again later.';
  }

  return (
    'HMRC could not send the invitation. The client was saved — please try again. ' +
    'If the problem continues, check your ARN in Settings → HMRC Connection.'
  );
}

/** User-facing message when POST /agents/{arn}/relationships fails or is inactive. */
export function relationshipErrorToUserMessage(httpStatus: number, responseText: string): string {
  const parsed = parseHmrcErrorJson(responseText);
  const code = parsed?.code;

  if (code === 'RELATIONSHIP_NOT_FOUND' || httpStatus === 404) {
    return (
      'This client has not authorised your firm yet, or the authorisation is no longer active. ' +
      'Send or resend an HMRC invitation and ask the client to accept it.'
    );
  }

  if (code === 'NO_PERMISSION_ON_AGENCY') {
    return (
      'The ARN in Settings does not match your HMRC connection. Correct your ARN and try again.'
    );
  }

  if (httpStatus === 401) {
    return 'Your HMRC connection has expired. Reconnect in Settings → HMRC Connection.';
  }

  if (httpStatus >= 500) {
    return 'HMRC is temporarily unavailable. Please try again later.';
  }

  return parsed?.message ?? 'Could not verify the HMRC agent–client relationship.';
}

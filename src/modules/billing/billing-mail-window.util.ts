/**
 * Pure helpers for the trial-email cron windows.
 * Amounts of time are in milliseconds from `now` to `trialEndsAt`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function msUntil(
  trialEndsAt: Date | string | null | undefined,
  now = new Date(),
): number | null {
  if (!trialEndsAt) return null;
  const ends = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  if (Number.isNaN(ends.getTime())) return null;
  return ends.getTime() - now.getTime();
}

/**
 * Day −2 reminder: send once when more than 1 day and at most 2 days remain.
 * Daily cron at ~08:00 hits this window once for a normal trial.
 */
export function shouldSendTrialEndingEmail(opts: {
  billingStatus: string | null | undefined;
  trialEndsAt: Date | string | null | undefined;
  alreadySent: boolean;
  now?: Date;
}): boolean {
  if (opts.billingStatus !== 'trial' || opts.alreadySent) return false;
  const left = msUntil(opts.trialEndsAt, opts.now);
  if (left === null) return false;
  return left > DAY_MS && left <= 2 * DAY_MS;
}

/** Trial has ended and we have not yet sent the expired notice. */
export function shouldSendTrialExpiredEmail(opts: {
  billingStatus: string | null | undefined;
  trialEndsAt: Date | string | null | undefined;
  alreadySent: boolean;
  now?: Date;
}): boolean {
  if (opts.billingStatus !== 'trial' || opts.alreadySent) return false;
  const left = msUntil(opts.trialEndsAt, opts.now);
  if (left === null) return false;
  return left <= 0;
}

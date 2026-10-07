export type TenantBillingStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';

export const BILLING_INCLUDED_CLIENTS = 50;
export const BILLING_BASE_GBP = 50;
/** Pence floor per extra client (50p). */
export const BILLING_EXTRA_FLOOR_GBP = 0.5;
/** First extra band starts at 90p and drops 10p every 50 clients. */
export const BILLING_EXTRA_START_GBP = 0.9;
export const BILLING_BAND_SIZE = 50;

export const DEFAULT_TRIAL_DAYS = 7;
export const PLATFORM_SETTING_TRIAL_DAYS = 'trial_days';

/** Stable codes for FE paywall routing. */
export const BILLING_ERROR = {
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  TRIAL_DOMAIN_USED: 'TRIAL_DOMAIN_USED',
} as const;

export type BillingErrorCode = (typeof BILLING_ERROR)[keyof typeof BILLING_ERROR];

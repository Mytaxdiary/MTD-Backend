import type { Tenant } from '../tenants/entities/tenant.entity';
import type { TenantBillingStatus } from './billing.constants';
import { BILLING_ERROR, type BillingErrorCode } from './billing.constants';

export interface BillingAccessResult {
  allowed: boolean;
  code?: BillingErrorCode;
  message?: string;
}

function statusOf(tenant: Tenant): TenantBillingStatus {
  return (tenant.billingStatus as TenantBillingStatus) ?? 'active';
}

/**
 * Whether a firm user may use the agent app.
 * Platform admins are checked separately (no tenant billing).
 */
export function evaluateBillingAccess(tenant: Tenant, now = new Date()): BillingAccessResult {
  const status = statusOf(tenant);

  if (status === 'active' || status === 'past_due') {
    return { allowed: true };
  }

  if (status === 'trial') {
    const endsAt = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
    if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt.getTime() > now.getTime()) {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: BILLING_ERROR.TRIAL_EXPIRED,
      message:
        'Your free trial has ended. Please subscribe to continue using My Tax Diary. [' +
        BILLING_ERROR.TRIAL_EXPIRED +
        ']',
    };
  }

  // cancelled / expired / unknown unpaid
  return {
    allowed: false,
    code: BILLING_ERROR.SUBSCRIPTION_REQUIRED,
    message:
      'A paid subscription is required to continue. Please subscribe from Plan & billing. [' +
      BILLING_ERROR.SUBSCRIPTION_REQUIRED +
      ']',
  };
}

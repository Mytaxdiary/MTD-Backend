import { evaluateBillingAccess } from './billing-access.util';
import type { Tenant } from '../tenants/entities/tenant.entity';

function tenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't1',
    firmName: 'Test',
    isActive: true,
    billingStatus: 'active',
    includedClientAllowance: 50,
    ...overrides,
  } as Tenant;
}

describe('evaluateBillingAccess', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('allows active and past_due subscriptions', () => {
    expect(evaluateBillingAccess(tenant({ billingStatus: 'active' }), now).allowed).toBe(true);
    expect(evaluateBillingAccess(tenant({ billingStatus: 'past_due' }), now).allowed).toBe(true);
  });

  it('allows trial before trialEndsAt', () => {
    const result = evaluateBillingAccess(
      tenant({
        billingStatus: 'trial',
        trialEndsAt: new Date('2026-06-08T12:00:00.000Z'),
      }),
      now,
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks expired trial with TRIAL_EXPIRED', () => {
    const result = evaluateBillingAccess(
      tenant({
        billingStatus: 'trial',
        trialEndsAt: new Date('2026-05-01T12:00:00.000Z'),
      }),
      now,
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TRIAL_EXPIRED');
    expect(result.message).toContain('[TRIAL_EXPIRED]');
  });

  it('blocks cancelled / expired with SUBSCRIPTION_REQUIRED', () => {
    expect(evaluateBillingAccess(tenant({ billingStatus: 'cancelled' }), now).code).toBe(
      'SUBSCRIPTION_REQUIRED',
    );
    expect(evaluateBillingAccess(tenant({ billingStatus: 'expired' }), now).code).toBe(
      'SUBSCRIPTION_REQUIRED',
    );
  });

  it('accepts string trialEndsAt from drivers', () => {
    const result = evaluateBillingAccess(
      tenant({
        billingStatus: 'trial',
        trialEndsAt: '2026-06-08T12:00:00.000Z' as unknown as Date,
      }),
      now,
    );
    expect(result.allowed).toBe(true);
  });
});

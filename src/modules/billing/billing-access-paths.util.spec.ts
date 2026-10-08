import { isBillingExemptPath } from './billing-access-paths.util';

describe('isBillingExemptPath', () => {
  it('allows checkout, portal, quote', () => {
    expect(isBillingExemptPath('/api/v1/billing/checkout')).toBe(true);
    expect(isBillingExemptPath('/api/v1/billing/portal')).toBe(true);
    expect(isBillingExemptPath('/api/v1/billing/quote?x=1')).toBe(true);
  });

  it('allows auth session helpers', () => {
    expect(isBillingExemptPath('/api/v1/auth/refresh')).toBe(true);
    expect(isBillingExemptPath('/api/v1/auth/session')).toBe(true);
    expect(isBillingExemptPath('/api/v1/auth/profile')).toBe(true);
    expect(isBillingExemptPath('/api/v1/auth/logout')).toBe(true);
  });

  it('blocks normal app routes', () => {
    expect(isBillingExemptPath('/api/v1/clients')).toBe(false);
    expect(isBillingExemptPath('/api/v1/billing/webhook')).toBe(false);
  });
});

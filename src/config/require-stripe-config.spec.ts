import { assertStripeConfigForBilling, isBillingEnabled } from './require-stripe-config';

describe('require-stripe-config', () => {
  const full = {
    NODE_ENV: 'development',
    BILLING_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    STRIPE_PRICE_BASE_ID: 'price_base',
    STRIPE_PRICE_EXTRA_ID: 'price_extra',
  };

  it('treats billing as enabled by default', () => {
    expect(isBillingEnabled({})).toBe(true);
    expect(isBillingEnabled({ BILLING_ENABLED: 'false' })).toBe(false);
  });

  it('skips checks in test env', () => {
    expect(() =>
      assertStripeConfigForBilling({
        ...full,
        NODE_ENV: 'test',
        STRIPE_SECRET_KEY: '',
      }),
    ).not.toThrow();
  });

  it('allows missing keys when billing is disabled', () => {
    expect(() =>
      assertStripeConfigForBilling({
        NODE_ENV: 'development',
        BILLING_ENABLED: 'false',
      }),
    ).not.toThrow();
  });

  it('requires all Stripe keys when billing is on (local + production)', () => {
    expect(() =>
      assertStripeConfigForBilling({
        NODE_ENV: 'development',
        BILLING_ENABLED: 'true',
        STRIPE_SECRET_KEY: 'sk_test_x',
      }),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);

    expect(() =>
      assertStripeConfigForBilling({
        NODE_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk_live_x',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        STRIPE_PRICE_BASE_ID: 'price_base',
        STRIPE_PRICE_EXTRA_ID: 'price_extra',
      }),
    ).not.toThrow();

    expect(() => assertStripeConfigForBilling(full)).not.toThrow();
  });
});

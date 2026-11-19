/**
 * Billing needs Stripe keys in every non-test environment.
 * Set BILLING_ENABLED=false only when you intentionally run without Checkout/Portal/webhooks.
 */
export function isBillingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.BILLING_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}

export function assertStripeConfigForBilling(env: NodeJS.ProcessEnv = process.env): void {
  const nodeEnv = (env.NODE_ENV ?? 'development').trim();
  if (nodeEnv === 'test') return;
  if (!isBillingEnabled(env)) return;

  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_BASE_ID',
    'STRIPE_PRICE_EXTRA_ID',
  ] as const;

  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length === 0) return;

  throw new Error(
    `Billing is enabled but Stripe config is incomplete (missing: ${missing.join(', ')}). ` +
      `Set these in the environment, or set BILLING_ENABLED=false to start without billing.`,
  );
}

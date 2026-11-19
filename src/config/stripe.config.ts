import { registerAs } from '@nestjs/config';
import { assertStripeConfigForBilling, isBillingEnabled } from './require-stripe-config';

export default registerAs('stripe', () => {
  // Runs after ConfigModule loads .env — never at import time.
  assertStripeConfigForBilling();

  return {
    billingEnabled: isBillingEnabled(),
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    priceBaseId: process.env.STRIPE_PRICE_BASE_ID ?? '',
    priceExtraId: process.env.STRIPE_PRICE_EXTRA_ID ?? '',
  };
});

import { registerAs } from '@nestjs/config';

export default registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  priceBaseId: process.env.STRIPE_PRICE_BASE_ID ?? '',
  priceExtraId: process.env.STRIPE_PRICE_EXTRA_ID ?? '',
}));

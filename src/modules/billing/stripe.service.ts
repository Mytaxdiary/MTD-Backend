import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
// CJS interop: `import Stripe from 'stripe'` becomes `.default` without esModuleInterop.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeSdk = require('stripe') as new (apiKey: string, config?: Stripe.StripeConfig) => Stripe;

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('stripe.secretKey')?.trim() ?? '';
    this.client = key
      ? new StripeSdk(key, {
          apiVersion: '2026-09-30.endive',
          typescript: true,
        })
      : null;
    if (!this.client) {
      this.logger.warn('STRIPE_SECRET_KEY not set — Checkout/Portal/webhooks disabled');
    }
  }

  get stripe(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return this.client;
  }

  get priceBaseId(): string {
    const id = this.config.get<string>('stripe.priceBaseId')?.trim() ?? '';
    if (!id) throw new ServiceUnavailableException('STRIPE_PRICE_BASE_ID is not configured');
    return id;
  }

  get priceExtraId(): string {
    const id = this.config.get<string>('stripe.priceExtraId')?.trim() ?? '';
    if (!id) throw new ServiceUnavailableException('STRIPE_PRICE_EXTRA_ID is not configured');
    return id;
  }

  get webhookSecret(): string {
    return this.config.get<string>('stripe.webhookSecret')?.trim() ?? '';
  }

  get isConfigured(): boolean {
    return !!this.client;
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.webhookSecret;
    if (!secret) {
      throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}

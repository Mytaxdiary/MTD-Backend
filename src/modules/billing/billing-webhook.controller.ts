import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { BillingStripeService } from './billing-stripe.service';

/**
 * Stripe webhooks — no JWT. Signature verified via STRIPE_WEBHOOK_SECRET.
 * Mounted under /billing/webhook; Nest rawBody must be enabled in main.ts.
 */
@ApiExcludeController()
@Controller('billing')
export class BillingWebhookController {
  constructor(private readonly billingStripe: BillingStripeService) {}

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Missing raw body for Stripe webhook');
    }
    return this.billingStripe.handleWebhook(rawBody, signature);
  }
}

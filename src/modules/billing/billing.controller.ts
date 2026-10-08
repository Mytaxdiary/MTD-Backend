import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthAudience } from '../../common/decorators/auth-audience.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { BillingService } from './billing.service';
import { BillingStripeService } from './billing-stripe.service';

interface AuthRequest extends ExpressRequest {
  user: RequestUser;
}

@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard)
@AuthAudience('firm')
@ApiBearerAuth('access-token')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingStripe: BillingStripeService,
  ) {}

  @Get('quote')
  @ApiOperation({ summary: 'Current billable client count and monthly fee (ex-VAT)' })
  @ApiOkResponse({ description: 'Usage quote for the signed-in firm' })
  async quote(@Request() req: AuthRequest) {
    return this.billingService.quoteForTenant(req.user.tenantId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe Checkout Session for subscription' })
  @ApiOkResponse({ description: 'Checkout URL to redirect the owner' })
  async checkout(@Request() req: AuthRequest) {
    return this.billingStripe.createCheckoutSession(
      req.user.tenantId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post('portal')
  @ApiOperation({ summary: 'Create Stripe Customer Portal session' })
  @ApiOkResponse({ description: 'Portal URL to redirect the owner' })
  async portal(@Request() req: AuthRequest) {
    return this.billingStripe.createPortalSession(req.user.tenantId, req.user.role);
  }
}

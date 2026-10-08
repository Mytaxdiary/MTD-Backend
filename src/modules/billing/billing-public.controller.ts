import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { calcMonthlyFee, type MonthlyFeeQuote } from './pricing.util';

/**
 * Public (no auth) billing endpoints for the marketing site.
 * Keeps a single source of truth for pricing math — marketing never
 * hardcodes rates, it always asks the API so it can't drift from
 * Settings / the authenticated quote.
 */
@ApiTags('Billing')
@Controller('billing/public')
export class BillingPublicController {
  @Get('estimate')
  @ApiOperation({
    summary: 'Monthly fee estimate for an arbitrary client count (marketing pricing calculator)',
  })
  @ApiOkResponse({ description: 'Pricing estimate for the given client count — no auth required' })
  estimate(@Query('clients') clientsRaw?: string): MonthlyFeeQuote {
    const parsed = Number.parseInt(clientsRaw ?? '0', 10);
    const clients = Number.isFinite(parsed) ? Math.min(100000, Math.max(0, parsed)) : 0;
    return calcMonthlyFee(clients);
  }
}

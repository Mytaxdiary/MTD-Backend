import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { buildHmrcFraudRequestContext } from '../hmrc/fraud-prevention.parser';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Aggregated dashboard summary for the current firm' })
  getSummary(@Request() req: ExpressRequest) {
    const actor = req.user as RequestUser;
    const fraudContext = buildHmrcFraudRequestContext(
      req,
      actor.email,
      actor.loginAt,
      actor.mfaAuthenticated,
    );
    return this.service.getSummary(actor.tenantId, actor, fraudContext);
  }
}

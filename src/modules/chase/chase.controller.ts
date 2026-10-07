import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { ChaseService } from './chase.service';
import { ListChaseClientsQueryDto } from './dto/list-chase-clients-query.dto';
import { buildHmrcFraudRequestContext } from '../hmrc/fraud-prevention.parser';

@ApiTags('chase')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('canChase')
@Controller('chase')
export class ChaseController {
  constructor(private readonly service: ChaseService) {}

  @Get('clients')
  @ApiOperation({
    summary:
      'Paginated authorised clients expanded to open HMRC business×quarter rows (fulfilled hidden)',
  })
  listNeedsChasing(@Request() req: ExpressRequest, @Query() query: ListChaseClientsQueryDto) {
    const actor = req.user as RequestUser;
    const fraudContext = buildHmrcFraudRequestContext(
      req,
      actor.email,
      actor.loginAt,
      actor.mfaAuthenticated,
    );
    return this.service.listNeedsChasing(actor.tenantId, query, actor, fraudContext);
  }
}

import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChaseService } from './chase.service';
import { ListChaseClientsQueryDto } from './dto/list-chase-clients-query.dto';

interface RequestUser {
  tenantId: string;
}

@ApiTags('chase')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chase')
export class ChaseController {
  constructor(private readonly service: ChaseService) {}

  @Get('clients')
  @ApiOperation({
    summary:
      'Paginated authorised clients expanded to open HMRC business×quarter rows (fulfilled hidden)',
  })
  listNeedsChasing(@Request() req: ExpressRequest, @Query() query: ListChaseClientsQueryDto) {
    const { tenantId } = req.user as RequestUser;
    return this.service.listNeedsChasing(tenantId, query);
  }
}

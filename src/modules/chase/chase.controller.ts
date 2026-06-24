import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChaseService } from './chase.service';

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
      'List all authorised clients with their chase summary and current quarter deadline',
  })
  listNeedsChasing(@Request() req: ExpressRequest) {
    const { tenantId } = req.user as RequestUser;
    return this.service.listNeedsChasing(tenantId);
  }
}

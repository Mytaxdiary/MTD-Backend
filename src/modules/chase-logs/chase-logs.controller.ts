import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ChaseLogsService } from './chase-logs.service';
import { CreateChaseLogDto } from './dto/create-chase-log.dto';

interface RequestUser {
  userId: string;
  tenantId: string;
  role?: string;
}

@ApiTags('chase-logs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('canChase')
@Controller('chase-logs')
export class ChaseLogsController {
  constructor(private readonly service: ChaseLogsService) {}

  private tid(req: ExpressRequest): string {
    return (req.user as RequestUser).tenantId;
  }

  private uid(req: ExpressRequest): string {
    return (req.user as RequestUser).userId;
  }

  private actor(req: ExpressRequest): RequestUser {
    return req.user as RequestUser;
  }

  @Post()
  @ApiOperation({ summary: 'Record a chase sent to a client' })
  create(@Request() req: ExpressRequest, @Body() dto: CreateChaseLogDto) {
    const actor = this.actor(req);
    return this.service.create(actor.tenantId, dto, actor.userId, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List chase logs for a client' })
  @ApiQuery({ name: 'clientId', required: true })
  listByClient(@Request() req: ExpressRequest, @Query('clientId') clientId: string) {
    const actor = this.actor(req);
    return this.service.listByClient(actor.tenantId, clientId, actor);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update chase log status (opened / responded / bounced)' })
  updateStatus(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.service.updateStatus(this.tid(req), id, status);
  }
}

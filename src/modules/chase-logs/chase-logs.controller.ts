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
import { ChaseLogsService } from './chase-logs.service';
import { CreateChaseLogDto } from './dto/create-chase-log.dto';

interface RequestUser {
  tenantId: string;
}

@ApiTags('chase-logs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chase-logs')
export class ChaseLogsController {
  constructor(private readonly service: ChaseLogsService) {}

  private tid(req: ExpressRequest): string {
    return (req.user as RequestUser).tenantId;
  }

  @Post()
  @ApiOperation({ summary: 'Record a chase sent to a client' })
  create(@Request() req: ExpressRequest, @Body() dto: CreateChaseLogDto) {
    return this.service.create(this.tid(req), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List chase logs for a client' })
  @ApiQuery({ name: 'clientId', required: true })
  listByClient(
    @Request() req: ExpressRequest,
    @Query('clientId') clientId: string,
  ) {
    return this.service.listByClient(this.tid(req), clientId);
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

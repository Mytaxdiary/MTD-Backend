import {
  Controller,
  Get,
  Patch,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppNotificationsService } from './app-notifications.service';

interface RequestUser {
  tenantId: string;
}

@ApiTags('app-notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('app-notifications')
export class AppNotificationsController {
  constructor(private readonly service: AppNotificationsService) {}

  private tid(req: ExpressRequest): string {
    return (req.user as RequestUser).tenantId;
  }

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the current firm' })
  list(@Request() req: ExpressRequest) {
    return this.service.list(this.tid(req));
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count of unread notifications' })
  async unreadCount(@Request() req: ExpressRequest) {
    const count = await this.service.unreadCount(this.tid(req));
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Request() req: ExpressRequest, @Param('id') id: string) {
    return this.service.markRead(this.tid(req), id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Request() req: ExpressRequest) {
    return this.service.markAllRead(this.tid(req));
  }
}

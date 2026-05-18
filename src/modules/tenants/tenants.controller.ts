import { Controller, Get, Patch, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateNotificationPreferencesDto } from '../users/dto/update-notification-preferences.dto';

@ApiTags('tenants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  private getTenantId(req: ExpressRequest): string {
    const tenantId = (req.user as { tenantId?: string })?.tenantId;
    if (!tenantId) throw new NotFoundException('No tenant associated with this account');
    return tenantId;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current firm details' })
  async getMyTenant(@Request() req: ExpressRequest) {
    const tenantId = this.getTenantId(req);
    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current firm details' })
  async updateMyTenant(@Request() req: ExpressRequest, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(this.getTenantId(req), dto);
  }

  @Get('me/notifications')
  @ApiOperation({ summary: 'Get notification preferences for this firm' })
  async getNotifications(@Request() req: ExpressRequest) {
    return this.tenantsService.getNotificationPreferences(this.getTenantId(req));
  }

  @Patch('me/notifications')
  @ApiOperation({ summary: 'Update notification preferences for this firm' })
  async updateNotifications(
    @Request() req: ExpressRequest,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.tenantsService.updateNotificationPreferences(this.getTenantId(req), dto);
  }
}

import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiQuery,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { AuthAudience } from '../../common/decorators/auth-audience.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { AuthService } from '../auth/auth.service';
import { BillingService } from '../billing/billing.service';
import { AdminService } from './admin.service';
import { AdminFirmsQueryDto } from './dto/admin-firms-query.dto';
import { SetFirmActiveDto } from './dto/set-firm-active.dto';
import { AdminEnquiriesQueryDto } from './dto/admin-enquiries-query.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { AdminAuditLogsQueryDto } from './dto/admin-audit-logs-query.dto';
import { ClearTrialDomainDto } from './dto/clear-trial-domain.dto';
import { SetTrialDaysDto } from './dto/set-trial-days.dto';

interface AuthRequest extends ExpressRequest {
  user: RequestUser;
}

/**
 * Platform admin APIs — product-owner only.
 * Firm owner/staff JWTs are rejected by JwtAuthGuard + @AuthAudience('admin').
 */
@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@AuthAudience('admin')
@ApiBearerAuth('access-token')
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminService: AdminService,
    private readonly billingService: BillingService,
  ) {}

  private actorFrom(req: AuthRequest) {
    return { userId: req.user.userId, email: req.user.email };
  }

  @Get('me')
  @ApiOperation({ summary: 'Current platform admin profile' })
  @ApiOkResponse({ description: 'Admin profile' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Not a platform admin' })
  async me(@Request() req: AuthRequest) {
    if (req.user.role !== 'admin') {
      throw new UnauthorizedException();
    }
    return this.authService.getProfile(req.user.userId);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview stats (read-only)' })
  @ApiOkResponse({ description: 'Aggregate firm and enquiry counts' })
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('firms')
  @ApiOperation({ summary: 'Paginated list of all firms/tenants' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'billingStatus',
    required: false,
    enum: ['trial', 'active', 'past_due', 'cancelled', 'expired'],
  })
  @ApiOkResponse({ description: 'Firm list page' })
  listFirms(@Query() query: AdminFirmsQueryDto) {
    return this.adminService.listFirms({
      page: query.page,
      limit: query.limit,
      search: query.search,
      billingStatus: query.billingStatus,
    });
  }

  @Delete('firms/by-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently purge a firm by user email (re-register support)',
    description:
      'Hard-deletes the firm/tenant, all its users, clients, and trial-domain lock so the email can register again. Platform admins cannot be purged.',
  })
  @ApiQuery({ name: 'email', required: true, type: String, example: 'owner@firm.co.uk' })
  @ApiOkResponse({ description: 'Firm purged' })
  @ApiNotFoundResponse({ description: 'No account for that email' })
  @ApiBadRequestResponse({ description: 'Invalid email or platform admin' })
  purgeFirmByEmail(@Query('email') email: string, @Request() req: AuthRequest) {
    return this.adminService.purgeFirmByEmail(email, this.actorFrom(req));
  }

  @Get('firms/:id')
  @ApiOperation({
    summary: 'Firm detail — users, client count, HMRC status, last login',
  })
  @ApiOkResponse({ description: 'Firm detail' })
  @ApiNotFoundResponse({ description: 'Firm not found' })
  getFirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getFirm(id);
  }

  @Patch('firms/:id/active')
  @ApiOperation({
    summary: 'Activate or deactivate a firm',
    description:
      'Deactivated firms cannot log in. All refresh tokens for the tenant are revoked. Optional reason is stored while inactive.',
  })
  @ApiOkResponse({ description: 'Updated firm detail' })
  @ApiNotFoundResponse({ description: 'Firm not found' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  setFirmActive(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetFirmActiveDto,
  ) {
    return this.adminService.setFirmActive(id, dto.isActive, dto.reason, this.actorFrom(req));
  }

  @Post('firms/:id/invalidate-sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force logout all users for a firm',
    description:
      'Revokes refresh tokens and invalidates access JWTs for every user on the firm. Does not deactivate the firm.',
  })
  @ApiOkResponse({ description: 'Firm detail after session invalidation' })
  @ApiNotFoundResponse({ description: 'Firm not found' })
  invalidateFirmSessions(@Request() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.invalidateFirmSessions(id, this.actorFrom(req));
  }

  @Post('firms/:id/users/:userId/invalidate-sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force logout a single firm user',
    description:
      'Revokes that user’s refresh tokens and invalidates their access JWT. Does not deactivate the account.',
  })
  @ApiOkResponse({ description: 'Firm detail after session invalidation' })
  @ApiNotFoundResponse({ description: 'Firm or user not found' })
  invalidateUserSessions(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.invalidateUserSessions(id, userId, this.actorFrom(req));
  }

  @Get('enquiries')
  @ApiOperation({ summary: 'Paginated list of marketing enquiries' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['new', 'contacted', 'closed'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOkResponse({ description: 'Enquiry list page' })
  listEnquiries(@Query() query: AdminEnquiriesQueryDto) {
    return this.adminService.listEnquiries({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
  }

  @Get('enquiries/:id')
  @ApiOperation({ summary: 'Enquiry detail' })
  @ApiOkResponse({ description: 'Enquiry detail' })
  @ApiNotFoundResponse({ description: 'Enquiry not found' })
  getEnquiry(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getEnquiry(id);
  }

  @Patch('enquiries/:id')
  @ApiOperation({
    summary: 'Update enquiry status and/or internal note',
    description: 'Reply email is out of scope for this task.',
  })
  @ApiOkResponse({ description: 'Updated enquiry' })
  @ApiNotFoundResponse({ description: 'Enquiry not found' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  updateEnquiry(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnquiryDto,
  ) {
    return this.adminService.updateEnquiry(
      id,
      {
        status: dto.status,
        internalNote: dto.internalNote,
      },
      this.actorFrom(req),
    );
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Paginated admin action audit log' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOkResponse({ description: 'Audit log page' })
  listAuditLogs(@Query() query: AdminAuditLogsQueryDto) {
    return this.adminService.listAuditLogs({
      page: query.page,
      limit: query.limit,
      action: query.action,
      search: query.search,
    });
  }

  @Get('billing/trial-days')
  @ApiOperation({ summary: 'Get platform default free-trial length (days)' })
  @ApiOkResponse({ description: 'Current trial_days platform setting' })
  async getTrialDays() {
    const days = await this.billingService.getTrialDays();
    return { days };
  }

  @Patch('billing/trial-days')
  @ApiOperation({
    summary: 'Set platform default free-trial length',
    description:
      'Updates platform_settings.trial_days used for new firm signups. Does not change existing trials.',
  })
  @ApiOkResponse({ description: 'Updated trial days' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  async setTrialDays(@Body() dto: SetTrialDaysDto) {
    const days = await this.billingService.setTrialDays(dto.days);
    return { days };
  }

  @Delete('billing/trial-domains')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear a corporate email domain trial lock',
    description:
      'Support-only: removes the domain from the trial registry so another signup can start a trial.',
  })
  @ApiOkResponse({ description: 'Domain cleared' })
  @ApiNotFoundResponse({ description: 'Domain not locked' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  clearTrialDomain(@Body() dto: ClearTrialDomainDto) {
    return this.billingService.clearTrialDomain(dto.domain);
  }
}

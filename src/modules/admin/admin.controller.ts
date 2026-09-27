import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  ParseUUIDPipe,
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
import { AdminService } from './admin.service';
import { AdminFirmsQueryDto } from './dto/admin-firms-query.dto';
import { SetFirmActiveDto } from './dto/set-firm-active.dto';
import { AdminEnquiriesQueryDto } from './dto/admin-enquiries-query.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';

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
  ) {}

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
  @ApiOkResponse({ description: 'Firm list page' })
  listFirms(@Query() query: AdminFirmsQueryDto) {
    return this.adminService.listFirms({
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
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
  setFirmActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetFirmActiveDto) {
    return this.adminService.setFirmActive(id, dto.isActive, dto.reason);
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
  updateEnquiry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEnquiryDto) {
    return this.adminService.updateEnquiry(id, {
      status: dto.status,
      internalNote: dto.internalNote,
    });
  }
}

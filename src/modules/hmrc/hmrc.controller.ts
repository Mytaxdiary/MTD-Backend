import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HmrcService } from './hmrc.service';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { UpdateArnDto } from './dto/update-arn.dto';
import { buildHmrcFraudRequestContext } from './fraud-prevention.parser';
import { summarizeFraudValidation } from './fraud-prevention.validation.util';

@ApiTags('HMRC')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('hmrc')
export class HmrcController {
  constructor(private readonly hmrcService: HmrcService) {}

  private getTenantId(req: ExpressRequest): string {
    const tenantId = (req.user as { tenantId?: string })?.tenantId;
    if (!tenantId) throw new NotFoundException('No tenant associated with this account');
    return tenantId;
  }

  private getUserEmail(req: ExpressRequest): string {
    return (req.user as { email?: string })?.email ?? '';
  }

  /**
   * HMRC sandbox only — client_credentials token, then create agent + individual test users
   * (Postman folder "00 - Test Users" steps 0–2).
   */
  @Post('sandbox/test-users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create HMRC sandbox agent and individual test users' })
  async createSandboxTestUsers(@Request() req: ExpressRequest) {
    this.getTenantId(req);
    return this.hmrcService.createSandboxTestUsers();
  }

  /** Returns the HMRC OAuth authorize URL. Frontend should redirect the user there. */
  @Get('connect')
  @ApiOperation({ summary: 'Get HMRC OAuth authorize URL' })
  getConnectUrl(@Request() req: ExpressRequest) {
    this.getTenantId(req);
    const authUrl = this.hmrcService.getAuthUrl();
    return { authUrl };
  }

  /** Exchanges the authorization code from HMRC callback and stores tokens. */
  @Post('callback')
  @ApiOperation({ summary: 'Exchange HMRC authorization code for tokens' })
  async handleCallback(
    @Request() req: ExpressRequest,
    @Body() dto: ExchangeCodeDto,
  ) {
    const tenantId = this.getTenantId(req);
    const connection = await this.hmrcService.exchangeCode(tenantId, dto.code);
    return {
      status: connection.status,
      connectedAt: connection.connectedAt,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      scope: connection.scope,
    };
  }

  /** Updates the ARN (Agent Reference Number) for this firm's HMRC connection. */
  @Patch('arn')
  @ApiOperation({ summary: 'Save or update the Agent Reference Number for this firm' })
  async updateArn(
    @Request() req: ExpressRequest,
    @Body() dto: UpdateArnDto,
  ) {
    const tenantId = this.getTenantId(req);
    const connection = await this.hmrcService.updateArn(tenantId, dto.arn);
    return { arn: connection.arn };
  }

  /** Refreshes the HMRC access token using the stored refresh token. */
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh HMRC access token using the stored refresh token' })
  async refreshToken(@Request() req: ExpressRequest) {
    const tenantId = this.getTenantId(req);
    const connection = await this.hmrcService.refreshHmrcTokens(tenantId);
    return {
      status: connection.status,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt ?? null,
      scope: connection.scope ?? null,
    };
  }

  /** Removes the HMRC connection for this firm. */
  @Delete('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect HMRC — removes stored tokens for this firm' })
  async disconnect(@Request() req: ExpressRequest) {
    const tenantId = this.getTenantId(req);
    await this.hmrcService.disconnect(tenantId);
  }

  /** Validates Gov-* fraud prevention headers with HMRC (sandbox/live test API). */
  @Get('validate-fraud-headers')
  @ApiOperation({ summary: 'Validate HMRC fraud prevention headers for the current session' })
  async validateFraudHeaders(@Request() req: ExpressRequest) {
    const tenantId = this.getTenantId(req);
    const fraudContext = buildHmrcFraudRequestContext(req, this.getUserEmail(req));
    const result = await this.hmrcService.validateFraudHeaders(tenantId, fraudContext);
    const summary = summarizeFraudValidation(result);
    return { ...summary, ...result };
  }

  /** Returns current HMRC connection status for this firm. */
  @Get('status')
  @ApiOperation({ summary: 'Get HMRC connection status for this firm' })
  async getStatus(@Request() req: ExpressRequest) {
    const tenantId = this.getTenantId(req);
    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection) return { connected: false };

    return {
      connected: connection.status === 'connected',
      status: connection.status,
      connectedAt: connection.connectedAt,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt ?? null,
      scope: connection.scope ?? null,
      arn: connection.arn ?? null,
    };
  }
}

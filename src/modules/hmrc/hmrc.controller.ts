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

  /** Removes the HMRC connection for this firm. */
  @Delete('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect HMRC — removes stored tokens for this firm' })
  async disconnect(@Request() req: ExpressRequest) {
    const tenantId = this.getTenantId(req);
    await this.hmrcService.disconnect(tenantId);
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

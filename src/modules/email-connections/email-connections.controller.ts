import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailConnectionsService } from './email-connections.service';
import { EmailCallbackDto } from './dto/email-callback.dto';
import { EmailConnectQueryDto } from './dto/email-connect-query.dto';

interface RequestUser {
  userId: string;
  tenantId: string;
  email?: string;
}

@ApiTags('Email')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailConnectionsController {
  constructor(private readonly emailConnectionsService: EmailConnectionsService) {}

  private user(req: ExpressRequest): RequestUser {
    const u = req.user as RequestUser | undefined;
    if (!u?.userId || !u?.tenantId) {
      throw new NotFoundException('No user/tenant associated with this account');
    }
    return u;
  }

  @Get('connect')
  @ApiOperation({ summary: 'Get Gmail or Outlook OAuth authorize URL' })
  getConnectUrl(@Request() req: ExpressRequest, @Query() query: EmailConnectQueryDto) {
    this.user(req);
    const authUrl = this.emailConnectionsService.getAuthUrl(query.provider);
    return { authUrl, provider: query.provider };
  }

  @Post('callback')
  @ApiOperation({ summary: 'Exchange OAuth authorization code and store mailbox tokens' })
  async handleCallback(@Request() req: ExpressRequest, @Body() dto: EmailCallbackDto) {
    const { userId, tenantId } = this.user(req);
    const connection = await this.emailConnectionsService.exchangeCode(
      userId,
      tenantId,
      dto.provider,
      dto.code,
    );
    return {
      connected: true,
      provider: connection.provider,
      emailAddress: connection.emailAddress,
      status: connection.status,
      connectedAt: connection.connectedAt,
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current agent email connection status' })
  async getStatus(@Request() req: ExpressRequest) {
    const { userId } = this.user(req);
    return this.emailConnectionsService.getStatus(userId);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh agent mailbox access token' })
  async refreshToken(@Request() req: ExpressRequest) {
    const { userId } = this.user(req);
    const connection = await this.emailConnectionsService.refreshTokens(userId);
    return {
      connected: connection.status === 'connected',
      provider: connection.provider,
      emailAddress: connection.emailAddress,
      status: connection.status,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
    };
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect agent mailbox' })
  async disconnect(@Request() req: ExpressRequest) {
    const { userId } = this.user(req);
    await this.emailConnectionsService.disconnect(userId);
  }
}

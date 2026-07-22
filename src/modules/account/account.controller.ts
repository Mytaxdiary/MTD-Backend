import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { AccountService } from './account.service';
import { ExportRequestDto } from './dto/export-request.dto';
import { DeletionRequestDto } from './dto/deletion-request.dto';

interface AuthRequest extends ExpressRequest {
  user: RequestUser;
}

@ApiTags('Account')
@Controller('account')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /**
   * Generates a ZIP export of all firm data and streams it as a download.
   * Requires the account password as step-up verification.
   * Rate-limited to 3 exports per minute.
   */
  @Post('data-export')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Export all firm data as a ZIP file' })
  @ApiOkResponse({ description: 'ZIP file streamed as download' })
  async exportData(
    @Body() dto: ExportRequestDto,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.accountService.generateExport(req.user.userId, dto.password, res);
  }

  @Get('deletion-request')
  @ApiOperation({ summary: 'Get current pending deletion request status' })
  @ApiOkResponse({ description: 'Deletion request status or null' })
  async getDeletionStatus(@Request() req: AuthRequest) {
    return this.accountService.getDeletionStatus(req.user.userId);
  }

  @Post('deletion-request')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Request account and data deletion (7-day grace period)' })
  @ApiCreatedResponse({ description: 'Deletion request created, executeAt returned' })
  async requestDeletion(
    @Body() dto: DeletionRequestDto,
    @Request() req: AuthRequest,
  ) {
    return this.accountService.requestDeletion(req.user.userId, dto.password, dto.mfaCode);
  }

  @Delete('deletion-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending deletion request' })
  @ApiOkResponse({ description: 'Deletion request cancelled' })
  async cancelDeletion(@Request() req: AuthRequest) {
    await this.accountService.cancelDeletion(req.user.userId);
    return { message: 'Deletion request cancelled successfully.' };
  }
}

import {
  Controller,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequireOwner } from '../../common/decorators/require-permission.decorator';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireOwner()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Clears all data for the user's firm (clients, HMRC connection, chase data,
   * notifications, portal data, uploaded files) but keeps the user account and
   * tenant row intact so the user can still log in.
   * Dev / testing only — not available in production.
   * Only the signed-in owner may clear their own account (prevents cross-firm wipe).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV ONLY] Clear all firm data for a user',
    description:
      'Deletes clients, HMRC connection, chase templates & logs, notifications, and portal data ' +
      "for the user's firm. The user account and tenant row are preserved so the account remains " +
      'usable. Use this to reset a test account without re-registering. Dev only.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({ description: 'Firm data cleared — account still active' })
  @ApiForbiddenResponse({ description: 'Not available in production' })
  async clearUserData(@Param('id') id: string, @Request() req: ExpressRequest) {
    const isProd = this.configService.get<string>('app.env') === 'production';
    if (isProd) {
      throw new ForbiddenException('This endpoint is not available in production');
    }

    const actor = req.user as RequestUser;
    if (id !== actor.userId) {
      throw new ForbiddenException('You can only clear data for your own account');
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    if (user.tenantId && actor.tenantId && user.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You can only clear data for your own firm');
    }

    await this.usersService.clearData(id);
    return {
      message: `All firm data for user ${id} has been cleared. The account is still active.`,
    };
  }
}

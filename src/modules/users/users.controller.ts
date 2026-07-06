import {
  Controller,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
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
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV ONLY] Clear all firm data for a user',
    description:
      'Deletes clients, HMRC connection, chase templates & logs, notifications, and portal data ' +
      'for the user\'s firm. The user account and tenant row are preserved so the account remains ' +
      'usable. Use this to reset a test account without re-registering. Dev only.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({ description: 'Firm data cleared — account still active' })
  @ApiForbiddenResponse({ description: 'Not available in production' })
  async clearUserData(@Param('id') id: string) {
    const isProd = this.configService.get<string>('app.env') === 'production';
    if (isProd) {
      throw new ForbiddenException('This endpoint is not available in production');
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    await this.usersService.clearData(id);
    return {
      message: `All firm data for user ${id} has been cleared. The account is still active.`,
    };
  }
}

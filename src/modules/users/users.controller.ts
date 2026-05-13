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
import { ApiTags, ApiOperation, ApiParam, ApiOkResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hard-deletes a user by ID.
   * Only available in non-production environments — for testing purposes only.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV ONLY] Hard-delete a user by ID',
    description:
      'Permanently removes a user and all related records (cascade). Only works outside of production. Used for testing auth flows.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({ description: 'User deleted successfully' })
  @ApiForbiddenResponse({ description: 'Not available in production' })
  async deleteUser(@Param('id') id: string) {
    const isProd = this.configService.get<string>('app.env') === 'production';
    if (isProd) {
      throw new ForbiddenException('This endpoint is not available in production');
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    await this.usersService.hardDelete(id);
    return { message: `User ${id} permanently deleted` };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { TeamService } from './team.service';
import { InviteStaffDto, UpdateStaffPermissionsDto } from './dto/team.dto';

@ApiTags('Team')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('canInviteStaff')
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List firm users and pending staff invitations' })
  async list(@Request() req: ExpressRequest) {
    const actor = req.user as RequestUser;
    this.teamService.assertCanManageTeam(actor);
    return this.teamService.list(actor.tenantId);
  }

  @Post('invites')
  @ApiOperation({ summary: 'Invite a staff member by email' })
  async invite(@Request() req: ExpressRequest, @Body() dto: InviteStaffDto) {
    return this.teamService.invite(req.user as RequestUser, dto);
  }

  @Patch('users/:id/permissions')
  @ApiOperation({ summary: 'Update a staff member permissions' })
  async updatePermissions(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStaffPermissionsDto,
  ) {
    return this.teamService.updatePermissions(req.user as RequestUser, id, dto.permissions);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a staff member from the firm' })
  async removeStaff(@Request() req: ExpressRequest, @Param('id') id: string) {
    await this.teamService.removeStaff(req.user as RequestUser, id);
    return { message: 'Staff member removed.' };
  }

  @Delete('invites/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending staff invitation' })
  async cancelInvite(@Request() req: ExpressRequest, @Param('id') id: string) {
    await this.teamService.cancelInvite(req.user as RequestUser, id);
    return { message: 'Invitation cancelled.' };
  }
}

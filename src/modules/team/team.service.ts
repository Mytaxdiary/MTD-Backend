import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { StaffInvite } from './entities/staff-invite.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { hashPassword } from '../../common/helpers/crypto.helper';
import {
  DEFAULT_STAFF_PERMISSIONS,
  hasPermission,
  normalizePermissions,
  resolveFirmRole,
  type FirmRole,
  type StaffPermissions,
} from '../users/permissions';
import type { InviteStaffDto } from './dto/team.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

const INVITE_EXPIRY_DAYS = 7;

export type TeamMemberStatus = 'active' | 'pending';

export interface TeamMemberDto {
  id: string;
  kind: 'user' | 'invite';
  name: string;
  email: string;
  role: FirmRole;
  status: TeamMemberStatus;
  permissions: StaffPermissions;
  invitedAt?: string;
}

export interface StaffInvitePreview {
  email: string;
  firstName: string;
  lastName: string;
  firmName: string;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectRepository(StaffInvite)
    private readonly inviteRepo: Repository<StaffInvite>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  assertCanManageTeam(actor: RequestUser): void {
    if (!hasPermission(actor, 'canInviteStaff')) {
      throw new ForbiddenException('You do not have permission to manage team members.');
    }
  }

  async list(tenantId: string): Promise<TeamMemberDto[]> {
    const users = await this.userRepo.find({ where: { tenantId, isActive: true } });
    const pending = await this.inviteRepo.find({
      where: { tenantId, acceptedAt: IsNull(), revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const now = new Date();

    const memberRows: TeamMemberDto[] = users.map((u) => {
      const role = resolveFirmRole(u.role?.name);
      return {
        id: u.id,
        kind: 'user',
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        role,
        status: 'active',
        permissions: normalizePermissions(u.permissions, role),
      };
    });

    const inviteRows: TeamMemberDto[] = pending
      .filter((inv) => inv.expiresAt >= now)
      .map((inv) => ({
        id: inv.id,
        kind: 'invite',
        name: `${inv.firstName} ${inv.lastName}`.trim(),
        email: inv.email,
        role: 'staff' as const,
        status: 'pending',
        permissions: normalizePermissions(inv.permissions, 'staff'),
        invitedAt: inv.createdAt.toISOString(),
      }));

    return [...memberRows, ...inviteRows];
  }

  async invite(actor: RequestUser, dto: InviteStaffDto): Promise<TeamMemberDto> {
    this.assertCanManageTeam(actor);
    const email = dto.email.toLowerCase().trim();
    const permissions = normalizePermissions(dto.permissions, 'staff');

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      if (existingUser.tenantId === actor.tenantId) {
        throw new ConflictException('This person is already in your firm.');
      }
      throw new ConflictException('An account with this email already exists.');
    }

    await this.inviteRepo.update(
      { tenantId: actor.tenantId, email, acceptedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = this.inviteRepo.create({
      tenantId: actor.tenantId,
      invitedByUserId: actor.userId,
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      permissions,
      tokenHash,
      expiresAt,
    });
    const saved = await this.inviteRepo.save(invite);

    const tenant = await this.tenantRepo.findOne({ where: { id: actor.tenantId } });
    const firmName = tenant?.firmName ?? 'your firm';
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/accept-invite?token=${rawToken}`;

    try {
      await this.mailService.sendStaffInviteEmail(email, {
        firstName: saved.firstName,
        firmName,
        inviteUrl,
      });
    } catch (err) {
      this.logger.error(`Failed to send staff invite email to ${email}`, err);
      await this.inviteRepo.delete(saved.id);
      throw new BadRequestException('The invitation email could not be sent. Please try again.');
    }

    return {
      id: saved.id,
      kind: 'invite',
      name: `${saved.firstName} ${saved.lastName}`.trim(),
      email: saved.email,
      role: 'staff',
      status: 'pending',
      permissions,
      invitedAt: saved.createdAt.toISOString(),
    };
  }

  async previewInvite(rawToken: string): Promise<StaffInvitePreview> {
    const invite = await this.findValidPendingInvite(rawToken);
    const tenant = await this.tenantRepo.findOne({ where: { id: invite.tenantId } });
    return {
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      firmName: tenant?.firmName ?? 'your firm',
    };
  }

  async acceptInvite(rawToken: string, password: string): Promise<User> {
    const invite = await this.findValidPendingInvite(rawToken);
    const exists = await this.usersService.emailExists(invite.email);
    if (exists) {
      throw new ConflictException('An account with this email already exists.');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: invite.tenantId } });
    const staffRole = await this.usersService.findOrCreateStaffRole();
    const passwordHash = await hashPassword(password);
    const permissions = normalizePermissions(invite.permissions, 'staff');

    const user = await this.usersService.create({
      firstName: invite.firstName,
      lastName: invite.lastName,
      firmName: tenant?.firmName ?? 'Firm',
      email: invite.email,
      passwordHash,
      role: staffRole,
      tenantId: invite.tenantId,
      permissions,
    });
    await this.usersService.markEmailVerified(user.id);

    invite.acceptedAt = new Date();
    invite.acceptedUserId = user.id;
    await this.inviteRepo.save(invite);

    return (await this.usersService.findById(user.id)) ?? user;
  }

  async updatePermissions(
    actor: RequestUser,
    userId: string,
    permissions: StaffPermissions,
  ): Promise<TeamMemberDto> {
    this.assertCanManageTeam(actor);
    const user = await this.requireTenantUser(actor.tenantId, userId);
    const role = resolveFirmRole(user.role?.name);
    if (role === 'owner') {
      throw new ForbiddenException('Owner permissions cannot be changed.');
    }
    user.permissions = normalizePermissions(permissions, 'staff');
    await this.userRepo.save(user);
    return {
      id: user.id,
      kind: 'user',
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role,
      status: 'active',
      permissions: user.permissions,
    };
  }

  async cancelInvite(actor: RequestUser, inviteId: string): Promise<void> {
    this.assertCanManageTeam(actor);
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId, tenantId: actor.tenantId },
    });
    if (!invite || invite.acceptedAt || invite.revokedAt) {
      throw new NotFoundException('Pending invitation not found.');
    }
    invite.revokedAt = new Date();
    await this.inviteRepo.save(invite);
  }

  async removeStaff(actor: RequestUser, userId: string): Promise<void> {
    this.assertCanManageTeam(actor);
    if (userId === actor.userId) {
      throw new BadRequestException('You cannot remove yourself.');
    }
    const user = await this.requireTenantUser(actor.tenantId, userId);
    if (resolveFirmRole(user.role?.name) === 'owner') {
      throw new ForbiddenException('The firm owner cannot be removed.');
    }

    await this.unassignClientsOfUser(user.id);
    await this.userRepo.manager.query(
      'UPDATE chase_logs SET sent_by_user_id = NULL WHERE sent_by_user_id = ?',
      [user.id],
    );
    await this.userRepo.manager.query('DELETE FROM email_connections WHERE user_id = ?', [user.id]);
    await this.userRepo.delete(user.id);
  }

  private async unassignClientsOfUser(userId: string): Promise<void> {
    const col = this.clientRepo.metadata.findColumnWithPropertyName('assignedToUserId');
    if (!col) return;
    await this.clientRepo
      .createQueryBuilder()
      .update(Client)
      .set({ [col.propertyName]: null })
      .where(`${col.databaseName} = :userId`, { userId })
      .execute();
  }

  private async requireTenantUser(tenantId: string, userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user || !user.isActive) throw new NotFoundException('Team member not found.');
    return user;
  }

  private async findValidPendingInvite(rawToken: string): Promise<StaffInvite> {
    if (!rawToken?.trim()) {
      throw new BadRequestException('This invitation link is invalid or has expired.');
    }
    const invite = await this.inviteRepo.findOne({
      where: { tokenHash: this.hashToken(rawToken), acceptedAt: IsNull(), revokedAt: IsNull() },
    });
    if (!invite || invite.expiresAt < new Date()) {
      throw new BadRequestException('This invitation link is invalid or has expired.');
    }
    return invite;
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}

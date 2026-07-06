import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { ChaseTemplate } from '../chase-templates/entities/chase-template.entity';
import { ChaseLog } from '../chase-logs/entities/chase-log.entity';
import { AppNotification } from '../app-notifications/entities/app-notification.entity';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';
import { ClientUser } from '../client-portal/entities/client-user.entity';
import { PortalMessage } from '../client-portal/entities/portal-message.entity';
import { PortalFile } from '../client-portal/entities/portal-file.entity';

const AGENT_ROLE = 'Agent';
const PORTAL_FILES_BASE = path.join(process.cwd(), 'uploads', 'portal-files');

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(HmrcConnection)
    private readonly hmrcConnectionRepo: Repository<HmrcConnection>,
    @InjectRepository(ChaseTemplate)
    private readonly chaseTemplateRepo: Repository<ChaseTemplate>,
    @InjectRepository(ChaseLog)
    private readonly chaseLogRepo: Repository<ChaseLog>,
    @InjectRepository(AppNotification)
    private readonly appNotificationRepo: Repository<AppNotification>,
    @InjectRepository(NotificationPreferences)
    private readonly notifPrefsRepo: Repository<NotificationPreferences>,
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(PortalMessage)
    private readonly portalMessageRepo: Repository<PortalMessage>,
    @InjectRepository(PortalFile)
    private readonly portalFileRepo: Repository<PortalFile>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await this.userRepo.count({ where: { email } });
    return count > 0;
  }

  async create(data: {
    firstName: string;
    lastName: string;
    firmName: string;
    email: string;
    passwordHash: string;
    role: Role;
    tenantId: string;
  }): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userRepo.update(id, { passwordHash });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.userRepo.update(id, { isEmailVerified: true });
  }

  /** Enable or disable MFA. Pass null totpSecret to clear it. */
  async setMfa(id: string, totpSecret: string | null, mfaEnabled: boolean): Promise<void> {
    await this.userRepo.update(id, {
      mfaEnabled,
      totpSecret: totpSecret ?? undefined,
    });
    if (!mfaEnabled) {
      await this.userRepo
        .createQueryBuilder()
        .update(User)
        .set({ totpSecret: () => 'NULL' })
        .where('id = :id', { id })
        .execute();
    }
  }

  /**
   * Clears all tenant data for the user's firm:
   *   - Clients (cascades portal messages, portal files, client_users in DB)
   *   - Chase logs, chase templates
   *   - HMRC connection
   *   - App notifications
   *   - Notification preferences
   *   - Physical portal file uploads on disk
   *
   * The user account and tenant row are preserved so the user can still log in.
   */
  async clearData(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const tenantId = user.tenantId;
    if (!tenantId) return;

    // Collect client IDs before deleting, needed for related tables
    const clients = await this.clientRepo.find({
      where: { tenantId },
      select: ['id'],
    });
    const clientIds = clients.map((c) => c.id);

    await this.dataSource.transaction(async (manager) => {
      if (clientIds.length > 0) {
        // Delete portal data explicitly (DB cascade may not cover all cases)
        await manager.delete(PortalFile, { clientId: In(clientIds) });
        await manager.delete(PortalMessage, { clientId: In(clientIds) });
        await manager.delete(ClientUser, { clientId: In(clientIds) });

        // Chase logs are keyed by clientId (no FK cascade in DB)
        await manager.delete(ChaseLog, { clientId: In(clientIds) });

        // Delete clients
        await manager.delete(Client, { tenantId });
      }

      // Delete tenant-level data
      await manager.delete(HmrcConnection, { tenantId });
      await manager.delete(ChaseTemplate, { tenantId });
      await manager.delete(AppNotification, { tenantId });
      await manager.delete(NotificationPreferences, { tenantId });
    });

    // Delete uploaded portal files from disk after transaction succeeds
    if (clientIds.length > 0) {
      for (const clientId of clientIds) {
        const dir = path.join(PORTAL_FILES_BASE, clientId);
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    }
  }

  /**
   * Permanently removes the user row.
   * Auth tokens cascade on user delete.
   * If this was the last user on the tenant, also removes all tenant data.
   * @deprecated Prefer clearData() for dev resets — it keeps the user account intact.
   */
  async hardDelete(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const tenantId = user.tenantId;

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(User, id);

      if (!tenantId) return;

      const remainingUsers = await manager.count(User, { where: { tenantId } });
      if (remainingUsers > 0) return;

      await manager.delete(Client, { tenantId });
      await manager.delete(Tenant, tenantId);
    });
  }

  /**
   * Finds the Agent role, creating it if it does not yet exist.
   * This is the only role supported in this phase.
   */
  async findOrCreateAgentRole(): Promise<Role> {
    let role = await this.roleRepo.findOne({ where: { name: AGENT_ROLE } });
    if (!role) {
      role = this.roleRepo.create({ name: AGENT_ROLE });
      role = await this.roleRepo.save(role);
    }
    return role;
  }
}

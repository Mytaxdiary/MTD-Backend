import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Enquiry, type EnquiryStatus } from '../enquiries/entities/enquiry.entity';
import { Client } from '../clients/entities/client.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { resolveFirmRole } from '../users/permissions';
import { emailDomain } from '../billing/email-domain.util';
import {
  AdminAuditLog,
  type AdminAuditAction,
  type AdminAuditTargetType,
} from './entities/admin-audit-log.entity';

const PORTAL_FILES_BASE = path.join(process.cwd(), 'uploads', 'portal-files');

export interface AdminActor {
  userId: string;
  email?: string | null;
}

export interface AdminOverviewStats {
  totalFirms: number;
  activeFirms: number;
  inactiveFirms: number;
  newSignupsThisWeek: number;
  newSignupsThisMonth: number;
  openEnquiries: number;
}

export interface AdminFirmListItem {
  id: string;
  firmName: string;
  ownerEmail: string | null;
  contactEmail: string | null;
  createdAt: string;
  isActive: boolean;
  /** Legacy package label — unused with usage pricing; kept for FE compat. */
  plan: string | null;
  billingStatus: string;
  trialEndsAt: string | null;
  status: 'active' | 'inactive';
}

export interface AdminFirmListResponse {
  items: AdminFirmListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminFirmUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminFirmDetail {
  id: string;
  firmName: string;
  ownerEmail: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  createdAt: string;
  isActive: boolean;
  plan: string | null;
  billingStatus: string;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialEmailDomain: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billableClientCount: number;
  includedClientAllowance: number;
  status: 'active' | 'inactive';
  deactivationReason: string | null;
  deactivatedAt: string | null;
  userCount: number;
  clientCount: number;
  lastLoginAt: string | null;
  hmrcConnected: boolean;
  hmrcStatus: string | null;
  hmrcConnectedAt: string | null;
  users: AdminFirmUser[];
}

export interface AdminEnquiryItem {
  id: string;
  name: string;
  firm: string;
  email: string;
  phone: string | null;
  message: string;
  sourcePage: string | null;
  planInterest: string | null;
  status: EnquiryStatus;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEnquiryListResponse {
  items: AdminEnquiryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminAuditLogItem {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  targetLabel: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminAuditLogListResponse {
  items: AdminAuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Enquiry)
    private readonly enquiryRepo: Repository<Enquiry>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(HmrcConnection)
    private readonly hmrcConnectionRepo: Repository<HmrcConnection>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepo: Repository<AdminAuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(): Promise<AdminOverviewStats> {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalFirms, activeFirms, newSignupsThisWeek, newSignupsThisMonth, openEnquiries] =
      await Promise.all([
        this.tenantRepo.count(),
        this.tenantRepo.count({ where: { isActive: true } }),
        this.tenantRepo
          .createQueryBuilder('t')
          .where('t.createdAt >= :weekAgo', { weekAgo })
          .getCount(),
        this.tenantRepo
          .createQueryBuilder('t')
          .where('t.createdAt >= :monthStart', { monthStart })
          .getCount(),
        this.enquiryRepo
          .createQueryBuilder('e')
          .where('e.status != :closed', { closed: 'closed' })
          .getCount(),
      ]);

    return {
      totalFirms,
      activeFirms,
      inactiveFirms: totalFirms - activeFirms,
      newSignupsThisWeek,
      newSignupsThisMonth,
      openEnquiries,
    };
  }

  async listFirms(opts: {
    page?: number;
    limit?: number;
    search?: string;
    billingStatus?: string;
  }): Promise<AdminFirmListResponse> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim();
    const billingStatus = opts.billingStatus?.trim();

    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (billingStatus) {
      qb.andWhere('t.billing_status = :billingStatus', { billingStatus });
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(t.firm_name) LIKE :q', { q })
            .orWhere('LOWER(t.contact_email) LIKE :q', { q })
            .orWhere(
              `EXISTS (
                SELECT 1 FROM users u
                INNER JOIN roles r ON r.id = u.role_id AND r.name = 'owner'
                WHERE u.tenant_id = t.id AND LOWER(u.email) LIKE :q
              )`,
              { q },
            );
        }),
      );
    }

    const [tenants, total] = await qb.getManyAndCount();
    const ownerEmails = await this.ownerEmailsForTenants(tenants.map((t) => t.id));

    const items: AdminFirmListItem[] = tenants.map((t) => ({
      id: t.id,
      firmName: t.firmName,
      ownerEmail: ownerEmails.get(t.id) ?? t.contactEmail ?? null,
      contactEmail: t.contactEmail ?? null,
      createdAt: t.createdAt.toISOString(),
      isActive: t.isActive,
      plan: null,
      billingStatus: t.billingStatus ?? 'active',
      trialEndsAt: t.trialEndsAt ? t.trialEndsAt.toISOString() : null,
      status: t.isActive ? 'active' : 'inactive',
    }));

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getFirm(id: string): Promise<AdminFirmDetail> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Firm not found');

    const [users, clientCount, hmrc] = await Promise.all([
      this.userRepo
        .createQueryBuilder('u')
        .innerJoinAndSelect('u.role', 'r')
        .where('u.tenant_id = :id', { id })
        .andWhere('r.name IN (:...roles)', { roles: ['owner', 'staff'] })
        .orderBy('r.name', 'ASC')
        .addOrderBy('u.createdAt', 'ASC')
        .getMany(),
      this.clientRepo.count({ where: { tenantId: id } }),
      this.hmrcConnectionRepo.findOne({ where: { tenantId: id } }),
    ]);

    const firmUsers: AdminFirmUser[] = users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: resolveFirmRole(u.role?.name),
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    }));

    const owner = firmUsers.find((u) => u.role === 'owner');
    const lastLoginAt =
      firmUsers
        .map((u) => u.lastLoginAt)
        .filter((v): v is string => !!v)
        .sort()
        .at(-1) ?? null;

    const hmrcConnected = !!hmrc && hmrc.status === 'connected';

    return {
      id: tenant.id,
      firmName: tenant.firmName,
      ownerEmail: owner?.email ?? tenant.contactEmail ?? null,
      contactName: tenant.contactName ?? null,
      contactEmail: tenant.contactEmail ?? null,
      phone: tenant.phone ?? null,
      address: tenant.address ?? null,
      postcode: tenant.postcode ?? null,
      createdAt: tenant.createdAt.toISOString(),
      isActive: tenant.isActive,
      plan: null,
      billingStatus: tenant.billingStatus ?? 'active',
      trialStartsAt: tenant.trialStartsAt ? tenant.trialStartsAt.toISOString() : null,
      trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
      trialEmailDomain: tenant.trialEmailDomain ?? null,
      stripeCustomerId: tenant.stripeCustomerId ?? null,
      stripeSubscriptionId: tenant.stripeSubscriptionId ?? null,
      billableClientCount: clientCount,
      includedClientAllowance: tenant.includedClientAllowance ?? 50,
      status: tenant.isActive ? 'active' : 'inactive',
      deactivationReason: tenant.deactivationReason ?? null,
      deactivatedAt: tenant.deactivatedAt ? tenant.deactivatedAt.toISOString() : null,
      userCount: firmUsers.length,
      clientCount,
      lastLoginAt,
      hmrcConnected,
      hmrcStatus: hmrc?.status ?? null,
      hmrcConnectedAt: hmrc?.connectedAt ? hmrc.connectedAt.toISOString() : null,
      users: firmUsers,
    };
  }

  /**
   * Activate or deactivate a firm. Deactivation blocks all tenant users from logging in
   * and revokes their refresh tokens. Optional reason is stored while inactive.
   */
  async setFirmActive(
    id: string,
    isActive: boolean,
    reason: string | undefined,
    actor: AdminActor,
  ): Promise<AdminFirmDetail> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Firm not found');

    if (tenant.isActive === isActive) {
      // Idempotent — still allow updating reason when already inactive
      if (!isActive && reason !== undefined) {
        const trimmed = reason.trim() || null;
        const previous = tenant.deactivationReason ?? null;
        tenant.deactivationReason = trimmed;
        await this.tenantRepo.save(tenant);
        if (previous !== trimmed) {
          await this.recordAudit({
            actor,
            action: 'firm.deactivation_reason_update',
            targetType: 'firm',
            targetId: tenant.id,
            targetLabel: tenant.firmName,
            summary: `Updated deactivation reason for ${tenant.firmName}`,
            metadata: { previousReason: previous, reason: trimmed },
          });
        }
      }
      return this.getFirm(id);
    }

    if (!isActive) {
      const trimmed = reason?.trim();
      if (trimmed !== undefined && trimmed.length === 0) {
        throw new BadRequestException('Reason cannot be empty when provided.');
      }
      tenant.isActive = false;
      tenant.deactivationReason = trimmed || null;
      tenant.deactivatedAt = new Date();
      await this.tenantRepo.save(tenant);
      await this.invalidateSessionsForUserIds(
        (await this.userRepo.find({ where: { tenantId: id }, select: ['id'] })).map((u) => u.id),
      );
      await this.recordAudit({
        actor,
        action: 'firm.deactivate',
        targetType: 'firm',
        targetId: tenant.id,
        targetLabel: tenant.firmName,
        summary: `Deactivated firm ${tenant.firmName}`,
        metadata: { reason: tenant.deactivationReason },
      });
    } else {
      tenant.isActive = true;
      tenant.deactivationReason = null;
      tenant.deactivatedAt = null;
      await this.tenantRepo.save(tenant);
      await this.recordAudit({
        actor,
        action: 'firm.activate',
        targetType: 'firm',
        targetId: tenant.id,
        targetLabel: tenant.firmName,
        summary: `Activated firm ${tenant.firmName}`,
      });
    }

    return this.getFirm(id);
  }

  /**
   * Force-logout every user in a firm: revoke refresh tokens and invalidate access JWTs.
   * Does not deactivate the firm — users can sign in again.
   */
  async invalidateFirmSessions(tenantId: string, actor: AdminActor): Promise<AdminFirmDetail> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Firm not found');

    const users = await this.userRepo.find({
      where: { tenantId },
      select: ['id'],
    });
    await this.invalidateSessionsForUserIds(users.map((u) => u.id));
    await this.recordAudit({
      actor,
      action: 'firm.invalidate_sessions',
      targetType: 'firm',
      targetId: tenant.id,
      targetLabel: tenant.firmName,
      summary: `Force-logged out all users for ${tenant.firmName}`,
      metadata: { userCount: users.length },
    });
    return this.getFirm(tenantId);
  }

  /**
   * Force-logout a single user on a firm (compromise / support).
   * Does not deactivate the user account.
   */
  async invalidateUserSessions(
    tenantId: string,
    userId: string,
    actor: AdminActor,
  ): Promise<AdminFirmDetail> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Firm not found');

    const user = await this.userRepo.findOne({
      where: { id: userId, tenantId },
      select: ['id', 'email', 'firstName', 'lastName'],
    });
    if (!user) throw new NotFoundException('User not found on this firm');

    await this.invalidateSessionsForUserIds([user.id]);
    const label = `${user.firstName} ${user.lastName}`.trim() || user.email;
    await this.recordAudit({
      actor,
      action: 'user.invalidate_sessions',
      targetType: 'user',
      targetId: user.id,
      targetLabel: label,
      summary: `Force-logged out ${label} on ${tenant.firmName}`,
      metadata: { tenantId: tenant.id, firmName: tenant.firmName, email: user.email },
    });
    return this.getFirm(tenantId);
  }

  async listEnquiries(opts: {
    page?: number;
    limit?: number;
    status?: EnquiryStatus;
    search?: string;
  }): Promise<AdminEnquiryListResponse> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim();

    const qb = this.enquiryRepo
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.status) {
      qb.andWhere('e.status = :status', { status: opts.status });
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(e.name) LIKE :q', { q })
            .orWhere('LOWER(e.firm) LIKE :q', { q })
            .orWhere('LOWER(e.email) LIKE :q', { q });
        }),
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((e) => this.toEnquiryItem(e)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getEnquiry(id: string): Promise<AdminEnquiryItem> {
    const enquiry = await this.enquiryRepo.findOne({ where: { id } });
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    return this.toEnquiryItem(enquiry);
  }

  async updateEnquiry(
    id: string,
    patch: { status?: EnquiryStatus; internalNote?: string | null },
    actor: AdminActor,
  ): Promise<AdminEnquiryItem> {
    const enquiry = await this.enquiryRepo.findOne({ where: { id } });
    if (!enquiry) throw new NotFoundException('Enquiry not found');

    if (patch.status === undefined && patch.internalNote === undefined) {
      throw new BadRequestException('Provide status and/or internalNote to update.');
    }

    const previousStatus = enquiry.status;
    const previousNote = enquiry.internalNote ?? null;

    if (patch.status !== undefined) {
      enquiry.status = patch.status;
    }
    if (patch.internalNote !== undefined) {
      const note = patch.internalNote === null ? null : patch.internalNote.trim() || null;
      enquiry.internalNote = note;
    }

    const saved = await this.enquiryRepo.save(enquiry);
    const label = `${saved.name} (${saved.firm})`;
    const parts: string[] = [];
    if (patch.status !== undefined && patch.status !== previousStatus) {
      parts.push(`status ${previousStatus} → ${patch.status}`);
    }
    if (patch.internalNote !== undefined && (enquiry.internalNote ?? null) !== previousNote) {
      parts.push(enquiry.internalNote ? 'internal note updated' : 'internal note cleared');
    }
    await this.recordAudit({
      actor,
      action: 'enquiry.update',
      targetType: 'enquiry',
      targetId: saved.id,
      targetLabel: label,
      summary:
        parts.length > 0
          ? `Updated enquiry ${label}: ${parts.join(', ')}`
          : `Updated enquiry ${label}`,
      metadata: {
        previousStatus,
        status: saved.status,
        noteChanged:
          patch.internalNote !== undefined && (saved.internalNote ?? null) !== previousNote,
      },
    });
    return this.toEnquiryItem(saved);
  }

  async listAuditLogs(opts: {
    page?: number;
    limit?: number;
    action?: AdminAuditAction;
    search?: string;
  }): Promise<AdminAuditLogListResponse> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim();

    const qb = this.auditLogRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.action) {
      qb.andWhere('a.action = :action', { action: opts.action });
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(a.actorEmail) LIKE :q', { q })
            .orWhere('LOWER(a.targetLabel) LIKE :q', { q })
            .orWhere('LOWER(a.summary) LIKE :q', { q });
        }),
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        actorEmail: row.actorEmail ?? null,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        targetLabel: row.targetLabel ?? null,
        summary: row.summary,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Permanently delete a firm by owner/staff email so they can register again.
   * Hard-deletes the tenant, all firm users, clients, and trial-domain lock.
   * Admin-only support tool — not for platform admin accounts.
   */
  async purgeFirmByEmail(
    emailRaw: string,
    actor: AdminActor,
  ): Promise<{
    deleted: true;
    email: string;
    tenantId: string;
    firmName: string;
    usersRemoved: number;
    clientsRemoved: number;
    trialDomainCleared: string | null;
  }> {
    const email = emailRaw.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('A valid email is required');
    }

    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['role'],
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException(`No account found for ${email}`);
    }
    if (!user.tenantId || user.role?.name === 'admin') {
      throw new BadRequestException('Cannot purge a platform admin account');
    }

    const tenantId = user.tenantId;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Firm for ${email} was not found`);
    }

    const firmUsers = await this.userRepo.find({
      where: { tenantId },
      select: ['id', 'email'],
      withDeleted: true,
    });
    const userIds = firmUsers.map((u) => u.id);

    const clients = await this.clientRepo.find({ where: { tenantId }, select: ['id'] });
    const clientIds = clients.map((c) => c.id);
    const domain = emailDomain(email);

    const inList = (ids: string[]) => ids.map(() => '?').join(',');

    await this.dataSource.transaction(async (manager) => {
      if (clientIds.length > 0) {
        const cIn = inList(clientIds);
        await manager.query(`DELETE FROM portal_files WHERE client_id IN (${cIn})`, clientIds);
        await manager.query(`DELETE FROM portal_messages WHERE client_id IN (${cIn})`, clientIds);
        await manager.query(`DELETE FROM client_users WHERE client_id IN (${cIn})`, clientIds);
        await manager.query(`DELETE FROM chase_logs WHERE client_id IN (${cIn})`, clientIds);
        await manager.query(`DELETE FROM client_notes WHERE client_id IN (${cIn})`, clientIds);
        await manager.query(
          `DELETE FROM client_status_history WHERE client_id IN (${cIn})`,
          clientIds,
        );
        await manager.query('DELETE FROM clients WHERE tenant_id = ?', [tenantId]);
      }

      await manager.query('DELETE FROM hmrc_connections WHERE tenant_id = ?', [tenantId]);
      await manager.query('DELETE FROM chase_templates WHERE tenant_id = ?', [tenantId]);
      await manager.query('DELETE FROM app_notifications WHERE tenant_id = ?', [tenantId]);
      await manager.query('DELETE FROM notification_preferences WHERE tenant_id = ?', [tenantId]);
      await manager.query('DELETE FROM email_connections WHERE tenant_id = ?', [tenantId]);
      await manager.query('DELETE FROM staff_invites WHERE tenant_id = ?', [tenantId]);
      await manager.query('DELETE FROM deletion_requests WHERE tenant_id = ?', [tenantId]);

      if (userIds.length > 0) {
        const uIn = inList(userIds);
        await manager.query(`DELETE FROM refresh_tokens WHERE user_id IN (${uIn})`, userIds);
        await manager.query(`DELETE FROM password_reset_tokens WHERE user_id IN (${uIn})`, userIds);
        await manager.query(
          `DELETE FROM email_verification_tokens WHERE user_id IN (${uIn})`,
          userIds,
        );
        await manager.query('DELETE FROM users WHERE tenant_id = ?', [tenantId]);
      }

      if (domain) {
        await manager.query('DELETE FROM trial_email_domains WHERE domain = ? OR tenant_id = ?', [
          domain,
          tenantId,
        ]);
      } else {
        await manager.query('DELETE FROM trial_email_domains WHERE tenant_id = ?', [tenantId]);
      }

      await manager.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
    });

    for (const clientId of clientIds) {
      const dir = path.join(PORTAL_FILES_BASE, clientId);
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (err) {
          this.logger.warn(`Could not remove portal files for ${clientId}: ${String(err)}`);
        }
      }
    }

    await this.recordAudit({
      actor,
      action: 'firm.purge',
      targetType: 'firm',
      targetId: tenantId,
      targetLabel: tenant.firmName,
      summary: `Purged firm ${tenant.firmName} (email ${email})`,
      metadata: {
        email,
        usersRemoved: userIds.length,
        clientsRemoved: clientIds.length,
        trialDomainCleared: domain,
      },
    });

    this.logger.warn(
      `Purged firm ${tenantId} (${tenant.firmName}) via email ${email} by admin ${actor.userId}`,
    );

    return {
      deleted: true,
      email,
      tenantId,
      firmName: tenant.firmName,
      usersRemoved: userIds.length,
      clientsRemoved: clientIds.length,
      trialDomainCleared: domain,
    };
  }

  private async recordAudit(input: {
    actor: AdminActor;
    action: AdminAuditAction;
    targetType: AdminAuditTargetType;
    targetId: string;
    targetLabel?: string | null;
    summary: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const row = this.auditLogRepo.create({
      actorUserId: input.actor.userId,
      actorEmail: input.actor.email?.trim() || null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });
    await this.auditLogRepo.save(row);
  }

  private toEnquiryItem(e: Enquiry): AdminEnquiryItem {
    return {
      id: e.id,
      name: e.name,
      firm: e.firm,
      email: e.email,
      phone: e.phone ?? null,
      message: e.message,
      sourcePage: e.sourcePage ?? null,
      planInterest: e.planInterest ?? null,
      status: e.status,
      internalNote: e.internalNote ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  /**
   * Revoke refresh tokens and stamp sessionInvalidatedAt so existing access JWTs
   * fail JwtStrategy immediately (iat older than invalidation).
   */
  private async invalidateSessionsForUserIds(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    const now = new Date();
    await this.userRepo.update({ id: In(userIds) }, { sessionInvalidatedAt: now });

    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ isRevoked: true })
      .where('user_id IN (:...userIds)', { userIds })
      .andWhere('is_revoked = :revoked', { revoked: false })
      .execute();
  }

  private async ownerEmailsForTenants(tenantIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (tenantIds.length === 0) return map;

    const rows = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.role', 'r')
      .select('u.tenant_id', 'tenantId')
      .addSelect('u.email', 'email')
      .where('u.tenant_id IN (:...tenantIds)', { tenantIds })
      .andWhere('r.name = :owner', { owner: 'owner' })
      .orderBy('u.createdAt', 'ASC')
      .getRawMany<{ tenantId: string; email: string }>();

    for (const row of rows) {
      if (!map.has(row.tenantId)) {
        map.set(row.tenantId, row.email);
      }
    }
    return map;
  }
}

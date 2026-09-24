import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Enquiry } from '../enquiries/entities/enquiry.entity';
import { Client } from '../clients/entities/client.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { resolveFirmRole } from '../users/permissions';

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
  /** Billing plan not modelled yet — always null for now. */
  plan: string | null;
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

@Injectable()
export class AdminService {
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
  }): Promise<AdminFirmListResponse> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim();

    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

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
  async setFirmActive(id: string, isActive: boolean, reason?: string): Promise<AdminFirmDetail> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Firm not found');

    if (tenant.isActive === isActive) {
      // Idempotent — still allow updating reason when already inactive
      if (!isActive && reason !== undefined) {
        tenant.deactivationReason = reason.trim() || null;
        await this.tenantRepo.save(tenant);
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
      await this.revokeTenantSessions(id);
    } else {
      tenant.isActive = true;
      tenant.deactivationReason = null;
      tenant.deactivatedAt = null;
      await this.tenantRepo.save(tenant);
    }

    return this.getFirm(id);
  }

  private async revokeTenantSessions(tenantId: string): Promise<void> {
    const users = await this.userRepo.find({
      where: { tenantId },
      select: ['id'],
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return;

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

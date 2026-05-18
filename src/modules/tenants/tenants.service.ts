import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateNotificationPreferencesDto } from '../users/dto/update-notification-preferences.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(NotificationPreferences)
    private readonly notifRepo: Repository<NotificationPreferences>,
  ) {}

  async create(
    firmName: string,
    prefill?: { contactName?: string; contactEmail?: string },
  ): Promise<Tenant> {
    const tenant = this.tenantRepo.create({
      firmName,
      isActive: true,
      contactName: prefill?.contactName,
      contactEmail: prefill?.contactEmail,
    });
    return this.tenantRepo.save(tenant);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { id } });
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  /** Returns notification preferences for a tenant, creating defaults on first call. */
  async getNotificationPreferences(tenantId: string): Promise<NotificationPreferences> {
    const existing = await this.notifRepo.findOne({ where: { tenantId } });
    if (existing) return existing;
    const prefs = this.notifRepo.create({ tenantId });
    return this.notifRepo.save(prefs);
  }

  async updateNotificationPreferences(
    tenantId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const prefs = await this.getNotificationPreferences(tenantId);
    Object.assign(prefs, dto);
    return this.notifRepo.save(prefs);
  }
}

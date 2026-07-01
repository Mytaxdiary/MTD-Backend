import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AppNotification } from './entities/app-notification.entity';

@Injectable()
export class AppNotificationsService {
  constructor(
    @InjectRepository(AppNotification)
    private readonly repo: Repository<AppNotification>,
  ) {}

  /** Create a new in-app notification for a tenant. */
  async create(params: {
    tenantId: string;
    type: string;
    title: string;
    body: string;
    clientId?: string | null;
  }): Promise<AppNotification> {
    const notif = this.repo.create({
      tenantId: params.tenantId,
      type: params.type,
      title: params.title,
      body: params.body,
      clientId: params.clientId ?? null,
    });
    return this.repo.save(notif);
  }

  /** List the 50 most recent notifications for a tenant (unread first, then newest). */
  async list(tenantId: string): Promise<AppNotification[]> {
    // MySQL does not support NULLS FIRST — use (read_at IS NULL) DESC to put unread rows first.
    return this.repo
      .createQueryBuilder('n')
      .where('n.tenant_id = :tenantId', { tenantId })
      .orderBy('(n.read_at IS NULL)', 'DESC')
      .addOrderBy('n.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }

  /** Count unread notifications for a tenant. */
  async unreadCount(tenantId: string): Promise<number> {
    return this.repo.count({
      where: { tenantId, readAt: IsNull(), deletedAt: IsNull() },
    });
  }

  /** Mark a single notification as read. */
  async markRead(tenantId: string, id: string): Promise<void> {
    await this.repo.update({ id, tenantId }, { readAt: new Date() });
  }

  /** Mark all notifications for a tenant as read. */
  async markAllRead(tenantId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(AppNotification)
      .set({ readAt: new Date() })
      .where('tenant_id = :tenantId AND read_at IS NULL AND deleted_at IS NULL', { tenantId })
      .execute();
  }
}

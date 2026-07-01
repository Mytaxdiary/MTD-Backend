import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

@Entity('app_notifications')
@Index('IDX_app_notifications_tenant_id', ['tenantId'])
export class AppNotification extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  /** e.g. "invite_accepted" */
  @Column({ name: 'type', type: 'varchar', length: 50 })
  type: string;

  @Column({ name: 'title', type: 'varchar', length: 300 })
  title: string;

  @Column({ name: 'body', type: 'varchar', length: 1000 })
  body: string;

  /** Optional reference to the related client. */
  @Column({ name: 'client_id', type: 'varchar', length: 36, nullable: true })
  clientId?: string | null;

  /** Null = unread. Set when the agent marks it read. */
  @Column({ name: 'read_at', type: 'datetime', precision: 6, nullable: true })
  readAt?: Date | null;
}

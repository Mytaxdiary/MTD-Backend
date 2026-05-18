import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Tenant } from './tenant.entity';

/**
 * Firm-level notification preferences.
 * One row per tenant. Created on first save; defaults apply until then.
 */
@Entity('notification_preferences')
export class NotificationPreferences extends BaseEntity {
  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, unique: true })
  tenantId: string;

  @Column({ name: 'chase_email', type: 'boolean', default: true })
  chaseEmail: boolean;

  @Column({ name: 'chase_sms', type: 'boolean', default: false })
  chaseSms: boolean;

  @Column({ name: 'overdue_alert', type: 'boolean', default: true })
  overdueAlert: boolean;

  @Column({ name: 'deadline_reminder', type: 'boolean', default: true })
  deadlineReminder: boolean;

  @Column({ name: 'invite_accepted', type: 'boolean', default: true })
  inviteAccepted: boolean;

  @Column({ name: 'liability_alert', type: 'boolean', default: true })
  liabilityAlert: boolean;

  @Column({ name: 'reminder_days', type: 'int', default: 14 })
  reminderDays: number;
}

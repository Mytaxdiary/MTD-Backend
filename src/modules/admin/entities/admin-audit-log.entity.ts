import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export type AdminAuditTargetType = 'firm' | 'user' | 'enquiry';

export type AdminAuditAction =
  | 'firm.activate'
  | 'firm.deactivate'
  | 'firm.deactivation_reason_update'
  | 'firm.invalidate_sessions'
  | 'firm.purge'
  | 'user.invalidate_sessions'
  | 'enquiry.update';

@Entity('admin_audit_logs')
@Index('IDX_admin_audit_logs_created_at', ['createdAt'])
@Index('IDX_admin_audit_logs_action', ['action'])
@Index('IDX_admin_audit_logs_actor_user_id', ['actorUserId'])
export class AdminAuditLog extends BaseEntity {
  @Column({ name: 'actor_user_id', type: 'varchar', length: 36 })
  actorUserId: string;

  /** Denormalised so the list stays readable if the admin user is later removed. */
  @Column({ name: 'actor_email', type: 'varchar', length: 255, nullable: true })
  actorEmail?: string | null;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action: AdminAuditAction;

  @Column({ name: 'target_type', type: 'varchar', length: 32 })
  targetType: AdminAuditTargetType;

  @Column({ name: 'target_id', type: 'varchar', length: 36 })
  targetId: string;

  /** Human label for the target (firm name, user email, enquiry contact). */
  @Column({ name: 'target_label', type: 'varchar', length: 255, nullable: true })
  targetLabel?: string | null;

  @Column({ name: 'summary', type: 'varchar', length: 500 })
  summary: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;
}

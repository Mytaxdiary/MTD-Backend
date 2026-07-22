import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export type DeletionStatus = 'pending' | 'cancelled' | 'completed';

/**
 * Records a deletion request raised by an account owner.
 * Actual deletion is executed after a 7-day grace period by a cron job.
 */
@Entity('deletion_requests')
export class DeletionRequest extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status: DeletionStatus;

  /** When the deletion will be (or was) executed — 7 days after request. */
  @Column({ name: 'execute_at', type: 'datetime' })
  executeAt: Date;

  /** When the deletion was actually processed (null until executed). */
  @Column({ name: 'executed_at', type: 'datetime', nullable: true })
  executedAt?: Date;

  /** Email address at time of request, used for confirmation emails. */
  @Column({ name: 'requester_email', type: 'varchar', length: 255 })
  requesterEmail: string;
}

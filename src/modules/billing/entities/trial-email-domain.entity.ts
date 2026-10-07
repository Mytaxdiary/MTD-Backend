import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Corporate email domains that have already consumed a free trial.
 * Public mailboxes (gmail, etc.) are never stored here.
 */
@Entity('trial_email_domains')
export class TrialEmailDomain extends BaseEntity {
  @Index('UQ_trial_email_domains_domain', { unique: true })
  @Column({ name: 'domain', type: 'varchar', length: 255 })
  domain: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string | null;

  @Column({ name: 'consumed_at', type: 'datetime' })
  consumedAt: Date;
}

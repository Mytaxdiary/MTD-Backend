import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Tenants table — each accounting firm/practice is one tenant.
 * Created automatically when an agent registers.
 * All domain records (clients, submissions, etc.) must reference tenant_id.
 */
@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ name: 'firm_name', type: 'varchar', length: 200 })
  firmName: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 200, nullable: true })
  contactName?: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address?: string;

  @Column({ name: 'postcode', type: 'varchar', length: 20, nullable: true })
  postcode?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Optional note when a platform admin deactivates the firm. Cleared on reactivate. */
  @Column({ name: 'deactivation_reason', type: 'text', nullable: true })
  deactivationReason?: string | null;

  @Column({ name: 'deactivated_at', type: 'datetime', nullable: true })
  deactivatedAt?: Date | null;
}

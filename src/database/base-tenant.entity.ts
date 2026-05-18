import { Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';

/**
 * Base entity for all domain records that must be tenant-isolated.
 * Extend this instead of BaseEntity for: clients, submissions, invoices, exports, etc.
 *
 * Every query on these entities MUST filter by tenantId from the JWT (req.user.tenantId).
 * Never query without a tenant filter — this is the row-level security boundary.
 */
export abstract class TenantAwareBaseEntity extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false, eager: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}

import { Column, Entity } from 'typeorm';
import { TenantAwareBaseEntity } from '../../../database/base-tenant.entity';

@Entity('chase_templates')
export class ChaseTemplate extends TenantAwareBaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  /** 'bookkeeping' | 'data-request' | 'general' */
  @Column({ name: 'type', type: 'varchar', length: 50 })
  type: string;

  @Column({ name: 'subject', type: 'varchar', length: 500 })
  subject: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  /** true = seeded default; false = user-created. Both can be edited / deleted. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}

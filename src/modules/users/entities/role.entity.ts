import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Roles table — single role for now: 'Agent'
 * Extended to support multiple roles in a future RBAC phase.
 */
@Entity('roles')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;
}

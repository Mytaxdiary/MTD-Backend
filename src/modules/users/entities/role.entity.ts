import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Roles table — firm: owner | staff; platform: admin (product-owner).
 */
@Entity('roles')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;
}

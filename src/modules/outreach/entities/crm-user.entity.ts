import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { CrmUserRole } from '../outreach.enums';

@Entity('outreach_crm_users')
export class CrmUser extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName: string;

  @Column({ type: 'enum', enum: CrmUserRole, default: CrmUserRole.OPERATOR })
  role: CrmUserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string;
}

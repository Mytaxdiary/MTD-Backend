import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Role } from './role.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import type { StaffPermissions } from '../permissions';

/**
 * Users table — agent/accountant accounts and platform product-owner admins.
 * firm_name maps to practiceName for firm users; platform admins use a fixed label.
 * Firm users belong to one tenant; platform admins have null tenant_id.
 */
@Entity('users')
export class User extends BaseEntity {
  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({ name: 'firm_name', type: 'varchar', length: 200 })
  firmName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled: boolean;

  /** AES-256-GCM encrypted TOTP secret (iv:authTag:ciphertext) or plain secret in dev. */
  @Column({ name: 'totp_secret', type: 'varchar', length: 500, nullable: true })
  totpSecret?: string;

  @ManyToOne(() => Role, { eager: true, nullable: true })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  /** Every user belongs to one tenant (accounting firm). */
  @ManyToOne(() => Tenant, { eager: false, nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  /** Granular flags. Owner always has all true. Staff flags are set at invite time. */
  @Column({ type: 'json', nullable: true })
  permissions?: StaffPermissions;
}

import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Role } from './role.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Users table — stores agent/accountant accounts.
 * firm_name maps to the frontend 'practiceName' field sent during registration.
 * Every user belongs to exactly one tenant (accounting firm).
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
}

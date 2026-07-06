import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Client } from '../../clients/entities/client.entity';
import { piiTransformer } from '../../../common/transformers/pii-column.transformer';

@Entity('client_users')
export class ClientUser extends BaseEntity {
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @OneToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 36, unique: true })
  clientId: string;

  /** Encrypted at rest (same transformer as client PII). */
  @Column({ name: 'email', type: 'varchar', length: 500, transformer: piiTransformer() })
  email: string;

  /**
   * HMAC-SHA256 of the normalised (lowercase trimmed) email.
   * Stored in plain text so we can do a fast DB-level WHERE lookup
   * without loading every row to decrypt.
   */
  @Column({ name: 'email_hash', type: 'varchar', length: 64, nullable: true })
  emailHash?: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string;

  /** One-time token sent in the portal invite email to let the client set their password. */
  @Column({ name: 'portal_setup_token', type: 'varchar', length: 100, nullable: true })
  portalSetupToken?: string;

  @Column({ name: 'portal_setup_token_expires_at', type: 'datetime', nullable: true })
  portalSetupTokenExpiresAt?: Date;

  /** True once the client has set their password. */
  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt?: Date;
}

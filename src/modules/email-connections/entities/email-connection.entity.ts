import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export type EmailProvider = 'gmail' | 'outlook';
export type EmailConnectionStatus = 'connected' | 'disconnected' | 'expired';

/**
 * Per-agent mailbox OAuth connection (Gmail or Outlook).
 * One active connection per user — used to send client-facing emails.
 */
@Entity('email_connections')
@Index('UQ_email_connections_user_id', ['userId'], { unique: true })
export class EmailConnection extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'provider', type: 'varchar', length: 20 })
  provider: EmailProvider;

  /** Connected mailbox address (from provider profile). */
  @Column({ name: 'email_address', type: 'varchar', length: 255 })
  emailAddress: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'access_token_expires_at', type: 'datetime' })
  accessTokenExpiresAt: Date;

  @Column({ name: 'refresh_token_expires_at', type: 'datetime', nullable: true })
  refreshTokenExpiresAt?: Date | null;

  @Column({ name: 'connected_at', type: 'datetime' })
  connectedAt: Date;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'connected',
  })
  status: EmailConnectionStatus;

  @Column({ name: 'scope', type: 'varchar', length: 500, nullable: true })
  scope?: string | null;
}

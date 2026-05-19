import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export type HmrcConnectionStatus = 'connected' | 'disconnected' | 'expired';

/**
 * Stores the HMRC OAuth connection for a firm (tenant-level, one per tenant).
 * Access/refresh tokens stored as plain text for sandbox.
 * TODO: encrypt at rest before production go-live.
 */
@Entity('hmrc_connections')
export class HmrcConnection extends BaseEntity {
  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, unique: true })
  tenantId: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'access_token_expires_at', type: 'datetime' })
  accessTokenExpiresAt: Date;

  @Column({ name: 'refresh_token_expires_at', type: 'datetime', nullable: true })
  refreshTokenExpiresAt?: Date;

  @Column({ name: 'connected_at', type: 'datetime' })
  connectedAt: Date;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'connected',
  })
  status: HmrcConnectionStatus;

  @Column({ name: 'scope', type: 'varchar', length: 500, nullable: true })
  scope?: string;

  @Column({ name: 'arn', type: 'varchar', length: 100, nullable: true })
  arn?: string;
}

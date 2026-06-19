import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { piiTransformer } from '../../../common/transformers/pii-column.transformer';

/** HMRC invitation status — any value returned by the API (not a fixed enum). */
export type InvitationStatus = string;

@Entity('clients')
// Unique per-tenant per-NINO enforced via deterministic HMAC hash (plaintext NINO is encrypted).
@Index('UQ_clients_tenant_nino_hash', ['tenantId', 'ninoHash'], { unique: true })
export class Client extends BaseEntity {
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  /** Encrypted at rest — AES-256-GCM via piiTransformer. */
  @Column({ name: 'name', type: 'varchar', length: 500, transformer: piiTransformer() })
  name: string;

  /** Encrypted at rest. Use ninoHash for DB queries / unique checks. */
  @Column({ name: 'nino', type: 'varchar', length: 500, transformer: piiTransformer() })
  nino: string;

  /**
   * Deterministic HMAC-SHA256 of the uppercase NINO.
   * Never exposed in API responses — used only for uniqueness enforcement.
   */
  @Column({ name: 'nino_hash', type: 'varchar', length: 64 })
  ninoHash: string;

  /** Encrypted at rest. */
  @Column({ name: 'postcode', type: 'varchar', length: 500, transformer: piiTransformer() })
  postcode: string;

  /** Encrypted at rest. */
  @Column({ name: 'email', type: 'varchar', length: 500, transformer: piiTransformer() })
  email: string;

  /** Encrypted at rest. */
  @Column({ name: 'phone', type: 'varchar', length: 500, nullable: true, transformer: piiTransformer(true) })
  phone?: string;

  @Column({ name: 'agent_type', type: 'varchar', length: 20, default: 'main' })
  agentType: string;

  @Column({ name: 'invitation_id', type: 'varchar', length: 100, nullable: true })
  invitationId?: string;

  @Column({
    name: 'invitation_status',
    type: 'varchar',
    length: 64,
    default: 'pending',
  })
  invitationStatus: InvitationStatus;

  @Column({ name: 'invitation_sent_at', type: 'datetime', nullable: true })
  invitationSentAt?: Date;

  @Column({ name: 'invitation_expires_at', type: 'datetime', nullable: true })
  invitationExpiresAt?: Date;

  @Column({ name: 'authorised_at', type: 'datetime', nullable: true })
  authorisedAt?: Date;
}

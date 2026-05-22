import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

/** HMRC invitation status — any value returned by the API (not a fixed enum). */
export type InvitationStatus = string;

@Entity('clients')
@Index('UQ_clients_tenant_nino', ['tenantId', 'nino'], { unique: true })
export class Client extends BaseEntity {
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'nino', type: 'varchar', length: 10 })
  nino: string;

  @Column({ name: 'postcode', type: 'varchar', length: 20 })
  postcode: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
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

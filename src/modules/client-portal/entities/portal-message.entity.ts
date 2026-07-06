import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Client } from '../../clients/entities/client.entity';

@Entity('portal_messages')
export class PortalMessage extends BaseEntity {
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  clientId: string;

  @Column({ name: 'subject', type: 'varchar', length: 300 })
  subject: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt?: Date;
}

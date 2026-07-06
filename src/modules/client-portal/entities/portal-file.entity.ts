import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Client } from '../../clients/entities/client.entity';

@Entity('portal_files')
export class PortalFile extends BaseEntity {
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

  /** Original filename as uploaded by the client. */
  @Column({ name: 'original_name', type: 'varchar', length: 500 })
  originalName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  /** File size in bytes. */
  @Column({ name: 'size', type: 'int', unsigned: true })
  size: number;

  /** Absolute path on disk where the file is stored. */
  @Column({ name: 'storage_path', type: 'varchar', length: 1000 })
  storagePath: string;

  /** Whether the agent has viewed/acknowledged this file. */
  @Column({ name: 'viewed_by_agent', type: 'boolean', default: false })
  viewedByAgent: boolean;
}

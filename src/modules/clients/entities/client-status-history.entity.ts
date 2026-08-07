import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export type ClientStatusHistorySource = 'system' | 'agent';

@Entity('client_status_history')
@Index('IDX_client_status_history_client_id', ['clientId'])
@Index('IDX_client_status_history_tenant_id', ['tenantId'])
export class ClientStatusHistory extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  clientId: string;

  /** Previous status; null for the first recorded transition. */
  @Column({ name: 'from_status', type: 'varchar', length: 32, nullable: true })
  fromStatus?: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 32 })
  toStatus: string;

  /** Null when source is system. */
  @Column({ name: 'changed_by_user_id', type: 'varchar', length: 36, nullable: true })
  changedByUserId?: string | null;

  @Column({ name: 'source', type: 'varchar', length: 16, default: 'system' })
  source: ClientStatusHistorySource;
}

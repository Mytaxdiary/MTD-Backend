import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** Where the failure was recorded. */
export type SystemErrorSource = 'hmrc' | 'api' | 'server';

@Entity('system_error_logs')
@Index('IDX_system_error_logs_created_at', ['createdAt'])
@Index('IDX_system_error_logs_source', ['source'])
@Index('IDX_system_error_logs_status_code', ['statusCode'])
@Index('IDX_system_error_logs_tenant_id', ['tenantId'])
@Index('IDX_system_error_logs_client_id', ['clientId'])
export class SystemErrorLog extends BaseEntity {
  /** hmrc | api | server */
  @Column({ name: 'source', type: 'varchar', length: 32 })
  source: SystemErrorSource;

  /** App route or HMRC URL path (truncated). */
  @Column({ name: 'endpoint', type: 'varchar', length: 500 })
  endpoint: string;

  @Column({ name: 'http_method', type: 'varchar', length: 16, nullable: true })
  httpMethod?: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode?: number | null;

  @Column({ name: 'message', type: 'varchar', length: 1000 })
  message: string;

  @Column({ name: 'client_id', type: 'varchar', length: 36, nullable: true })
  clientId?: string | null;

  /** Denormalised client display name for the admin list. */
  @Column({ name: 'client_label', type: 'varchar', length: 255, nullable: true })
  clientLabel?: string | null;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string | null;

  /** Denormalised firm name for the admin list. */
  @Column({ name: 'tenant_label', type: 'varchar', length: 255, nullable: true })
  tenantLabel?: string | null;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;
}

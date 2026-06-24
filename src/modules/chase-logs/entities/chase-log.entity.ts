import { Column, Entity } from 'typeorm';
import { TenantAwareBaseEntity } from '../../../database/base-tenant.entity';

/**
 * Records every chase message sent to a client.
 * subject/body are stored already rendered (variables substituted)
 * so the history is accurate even if the template is later edited.
 */
@Entity('chase_logs')
export class ChaseLog extends TenantAwareBaseEntity {
  /** FK to clients.id */
  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  clientId: string;

  /** FK to chase_templates.id — nullable so logs survive template deletion */
  @Column({ name: 'template_id', type: 'varchar', length: 36, nullable: true })
  templateId?: string;

  /** Delivery channel used */
  @Column({ name: 'channel', type: 'varchar', length: 10, default: 'email' })
  channel: string;

  /** Rendered subject (variables already substituted) */
  @Column({ name: 'subject', type: 'varchar', length: 500 })
  subject: string;

  /** Rendered body (variables already substituted) */
  @Column({ name: 'body', type: 'text' })
  body: string;

  /** sent | opened | responded | bounced */
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'sent' })
  status: string;

  @Column({ name: 'sent_at', type: 'datetime' })
  sentAt: Date;
}

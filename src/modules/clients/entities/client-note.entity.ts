import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

@Entity('client_notes')
@Index('IDX_client_notes_client_id', ['clientId'])
@Index('IDX_client_notes_tenant_id', ['tenantId'])
export class ClientNote extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  clientId: string;

  @Column({ name: 'text', type: 'text' })
  text: string;

  @Column({ name: 'author_name', type: 'varchar', length: 200 })
  authorName: string;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned: boolean;
}

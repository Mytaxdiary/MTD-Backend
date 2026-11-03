import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { LinkAsset, TemplateChannel } from '../outreach.enums';

@Entity('outreach_templates')
export class Template extends BaseEntity {
  @Column({ name: 'handbook_code', type: 'varchar', length: 32 })
  handbookCode: string;

  @Column({ type: 'varchar', length: 32, default: '1.0' })
  version: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'enum', enum: TemplateChannel, default: TemplateChannel.EMAIL })
  channel: TemplateChannel;

  @Column({ type: 'varchar', length: 512, nullable: true })
  subject?: string;

  @Column({ type: 'mediumtext' })
  body: string;

  @Column({ name: 'link_asset', type: 'enum', enum: LinkAsset, default: LinkAsset.NONE })
  linkAsset: LinkAsset;

  @Column({ name: 'merge_fields_json', type: 'json', nullable: true })
  mergeFieldsJson?: string[];

  @Column({ type: 'varchar', length: 120, nullable: true })
  author?: string;

  @Column({ name: 'retired_at', type: 'datetime', precision: 6, nullable: true })
  retiredAt?: Date;
}

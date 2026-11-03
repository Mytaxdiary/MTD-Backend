import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  BlockReason,
  ResponseCategory,
  TouchChannel,
  TouchDirection,
  TouchEventType,
} from '../outreach.enums';
import { Campaign } from './campaign.entity';
import { Contact } from './contact.entity';
import { CrmUser } from './crm-user.entity';
import { Firm } from './firm.entity';
import { Sequence } from './sequence.entity';
import { Template } from './template.entity';

/** Append-only timeline — no soft delete / update expected in normal ops. */
@Entity('outreach_touchpoints')
export class Touchpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contact_id', type: 'char', length: 36, nullable: true })
  contactId?: string;

  @ManyToOne(() => Contact, { nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact?: Contact;

  @Column({ name: 'firm_id', type: 'char', length: 36, nullable: true })
  firmId?: string;

  @ManyToOne(() => Firm, { nullable: true })
  @JoinColumn({ name: 'firm_id' })
  firm?: Firm;

  @Column({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt: Date;

  @Column({ type: 'enum', enum: TouchChannel })
  channel: TouchChannel;

  @Column({ type: 'enum', enum: TouchDirection })
  direction: TouchDirection;

  @Column({ name: 'event_type', type: 'enum', enum: TouchEventType })
  eventType: TouchEventType;

  @Column({ name: 'sequence_id', type: 'char', length: 36, nullable: true })
  sequenceId?: string;

  @ManyToOne(() => Sequence, { nullable: true })
  @JoinColumn({ name: 'sequence_id' })
  sequence?: Sequence;

  @Column({ name: 'step_number', type: 'int', nullable: true })
  stepNumber?: number;

  @Column({ name: 'template_id', type: 'char', length: 36, nullable: true })
  templateId?: string;

  @ManyToOne(() => Template, { nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: Template;

  @Column({ name: 'template_version', type: 'varchar', length: 32, nullable: true })
  templateVersion?: string;

  @Column({ name: 'campaign_id', type: 'char', length: 36, nullable: true })
  campaignId?: string;

  @ManyToOne(() => Campaign, { nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Campaign;

  @Column({ type: 'varchar', length: 64, nullable: true })
  arm?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  summary?: string;

  @Column({
    name: 'response_category',
    type: 'enum',
    enum: ResponseCategory,
    nullable: true,
  })
  responseCategory?: ResponseCategory;

  @Column({ type: 'varchar', length: 255, nullable: true })
  outcome?: string;

  @Column({ name: 'external_ids_json', type: 'json', nullable: true })
  externalIdsJson?: Record<string, string>;

  @Column({ name: 'logged_by_user_id', type: 'char', length: 36, nullable: true })
  loggedByUserId?: string;

  @ManyToOne(() => CrmUser, { nullable: true })
  @JoinColumn({ name: 'logged_by_user_id' })
  loggedBy?: CrmUser;

  @Column({ name: 'logged_at', type: 'datetime', precision: 6 })
  loggedAt: Date;

  @Column({ name: 'block_reason', type: 'enum', enum: BlockReason, nullable: true })
  blockReason?: BlockReason;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}

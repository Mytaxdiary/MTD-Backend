import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import {
  EmailStatus,
  EmailType,
  LinkedInConnectionStatus,
  NextActionType,
  ProspectStatus,
} from '../outreach.enums';
import { CrmUser } from './crm-user.entity';
import { Firm } from './firm.entity';
import { Sequence } from './sequence.entity';

@Entity('outreach_contacts')
export class Contact extends BaseEntity {
  /** Permanent spine id — Instantly import or CRM-issued; never reuse. */
  @Column({ name: 'recipient_id', type: 'varchar', length: 64, unique: true })
  recipientId: string;

  @Column({ name: 'firm_id', type: 'char', length: 36 })
  firmId: string;

  @ManyToOne(() => Firm)
  @JoinColumn({ name: 'firm_id' })
  firm: Firm;

  @Column({ name: 'first_name', type: 'varchar', length: 120, nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', type: 'varchar', length: 120, nullable: true })
  lastName?: string;

  @Column({ name: 'name_verified', type: 'boolean', default: false })
  nameVerified: boolean;

  @Column({ type: 'varchar', length: 64, default: 'Hello,' })
  salutation: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({
    name: 'email_status',
    type: 'enum',
    enum: EmailStatus,
    default: EmailStatus.UNVERIFIED,
  })
  emailStatus: EmailStatus;

  @Column({
    name: 'email_type',
    type: 'enum',
    enum: EmailType,
    default: EmailType.NAMED_PERSON,
  })
  emailType: EmailType;

  @Column({ name: 'role_title', type: 'varchar', length: 160, nullable: true })
  roleTitle?: string;

  @Column({ name: 'linkedin_url', type: 'varchar', length: 512, nullable: true })
  linkedinUrl?: string;

  @Column({
    name: 'linkedin_connection_status',
    type: 'enum',
    enum: LinkedInConnectionStatus,
    default: LinkedInConnectionStatus.NOT_SENT,
  })
  linkedinConnectionStatus: LinkedInConnectionStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone?: string;

  @Column({ name: 'ctps_tps_screened_on', type: 'date', nullable: true })
  ctpsTpsScreenedOn?: string;

  @Column({ name: 'channel_preference', type: 'varchar', length: 64, nullable: true })
  channelPreference?: string;

  @Column({ name: 'do_not_contact', type: 'boolean', default: false })
  doNotContact: boolean;

  /** When true, cold sends stay drafted until an admin releases the contact. */
  @Column({ name: 'send_held', type: 'boolean', default: true })
  sendHeld: boolean;

  @Column({ type: 'enum', enum: ProspectStatus, default: ProspectStatus.NEW })
  status: ProspectStatus;

  @Column({ name: 'current_sequence_id', type: 'char', length: 36, nullable: true })
  currentSequenceId?: string;

  @ManyToOne(() => Sequence, { nullable: true })
  @JoinColumn({ name: 'current_sequence_id' })
  currentSequence?: Sequence;

  @Column({ name: 'current_step', type: 'int', nullable: true })
  currentStep?: number;

  @Column({
    name: 'next_action_type',
    type: 'enum',
    enum: NextActionType,
    default: NextActionType.NONE,
  })
  nextActionType: NextActionType;

  @Column({ name: 'next_action_due', type: 'datetime', precision: 6, nullable: true })
  nextActionDue?: Date;

  @Column({ name: 'next_action_owner_id', type: 'char', length: 36, nullable: true })
  nextActionOwnerId?: string;

  @ManyToOne(() => CrmUser, { nullable: true })
  @JoinColumn({ name: 'next_action_owner_id' })
  nextActionOwner?: CrmUser;

  @Column({ name: 'reapproach_date', type: 'date', nullable: true })
  reapproachDate?: string;

  @Column({ name: 'reapproach_angle_required', type: 'varchar', length: 255, nullable: true })
  reapproachAngleRequired?: string;

  @Column({ name: 'reapproach_cycles', type: 'int', default: 0 })
  reapproachCycles: number;

  @Column({ name: 'first_touch_source', type: 'varchar', length: 160, nullable: true })
  firstTouchSource?: string;

  @Column({ name: 'last_touch_source', type: 'varchar', length: 160, nullable: true })
  lastTouchSource?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}

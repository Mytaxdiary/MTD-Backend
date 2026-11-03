import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Contact } from './contact.entity';
import { Firm } from './firm.entity';

@Entity('outreach_trials')
export class Trial extends BaseEntity {
  @Column({ name: 'product_trial_id', type: 'varchar', length: 64, nullable: true, unique: true })
  productTrialId?: string;

  @Column({ name: 'contact_id', type: 'char', length: 36 })
  contactId: string;

  @ManyToOne(() => Contact)
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @Column({ name: 'firm_id', type: 'char', length: 36 })
  firmId: string;

  @ManyToOne(() => Firm)
  @JoinColumn({ name: 'firm_id' })
  firm: Firm;

  /** Optional note only — MTD has usage pricing, not Dash package tiers. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  plan?: string;

  @Column({ name: 'signup_at', type: 'datetime', precision: 6 })
  signupAt: Date;

  /** Default product trial length: 7 days. */
  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'hmrc_connected_at', type: 'datetime', precision: 6, nullable: true })
  hmrcConnectedAt?: Date;

  @Column({ name: 'first_client_added_at', type: 'datetime', precision: 6, nullable: true })
  firstClientAddedAt?: Date;

  @Column({ name: 'client_count', type: 'int', default: 0 })
  clientCount: number;

  @Column({ name: 'converted_at', type: 'datetime', precision: 6, nullable: true })
  convertedAt?: Date;

  @Column({ name: 'closed_at', type: 'datetime', precision: 6, nullable: true })
  closedAt?: Date;

  @Column({ name: 'attribution_json', type: 'json', nullable: true })
  attributionJson?: Record<string, string>;

  @Column({ type: 'boolean', default: false })
  unattributed: boolean;
}

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export type EnquiryStatus = 'new' | 'contacted' | 'closed';

/**
 * Marketing-site contact / package enquiry.
 * Public submissions; later surfaced in the admin panel.
 */
@Entity('enquiries')
export class Enquiry extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'firm', type: 'varchar', length: 200 })
  firm: string;

  @Index('idx_enquiries_email')
  @Column({ name: 'email', type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'phone', type: 'varchar', length: 40, nullable: true })
  phone?: string | null;

  @Column({ name: 'message', type: 'text' })
  message: string;

  @Column({ name: 'source_page', type: 'varchar', length: 120, nullable: true })
  sourcePage?: string | null;

  @Column({ name: 'plan_interest', type: 'varchar', length: 40, nullable: true })
  planInterest?: string | null;

  @Index('idx_enquiries_status')
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'new' })
  status: EnquiryStatus;

  @Column({ name: 'internal_note', type: 'text', nullable: true })
  internalNote?: string | null;
}

import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { TaskStatus, TaskType } from '../outreach.enums';
import { Contact } from './contact.entity';
import { CrmUser } from './crm-user.entity';
import { Template } from './template.entity';

@Entity('outreach_tasks')
export class Task extends BaseEntity {
  @Column({ name: 'contact_id', type: 'char', length: 36 })
  contactId: string;

  @ManyToOne(() => Contact)
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @Column({ type: 'enum', enum: TaskType })
  type: TaskType;

  @Column({ name: 'due_at', type: 'datetime', precision: 6 })
  dueAt: Date;

  @Column({ name: 'owner_user_id', type: 'char', length: 36, nullable: true })
  ownerUserId?: string;

  @ManyToOne(() => CrmUser, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner?: CrmUser;

  /** 1 reply, 2 demo, 3 follow-up, 4 new send */
  @Column({ type: 'int', default: 4 })
  priority: number;

  @Column({ name: 'generated_by_rule', type: 'varchar', length: 64, nullable: true })
  generatedByRule?: string;

  @Column({ name: 'suggested_template_id', type: 'char', length: 36, nullable: true })
  suggestedTemplateId?: string;

  @ManyToOne(() => Template, { nullable: true })
  @JoinColumn({ name: 'suggested_template_id' })
  suggestedTemplate?: Template;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.OPEN })
  status: TaskStatus;

  @Column({ name: 'skip_reason', type: 'varchar', length: 255, nullable: true })
  skipReason?: string;
}

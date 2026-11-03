import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { StepExecutor, TemplateChannel } from '../outreach.enums';
import { Sequence } from './sequence.entity';
import { Template } from './template.entity';

@Entity('outreach_sequence_steps')
export class SequenceStep extends BaseEntity {
  @Column({ name: 'sequence_id', type: 'char', length: 36 })
  sequenceId: string;

  @ManyToOne(() => Sequence, (s) => s.steps)
  @JoinColumn({ name: 'sequence_id' })
  sequence: Sequence;

  @Column({ name: 'step_number', type: 'int' })
  stepNumber: number;

  @Column({ name: 'day_offset', type: 'int', nullable: true })
  dayOffset?: number;

  @Column({ name: 'trigger_event', type: 'varchar', length: 64, nullable: true })
  triggerEvent?: string;

  @Column({ name: 'template_id', type: 'char', length: 36 })
  templateId: string;

  @ManyToOne(() => Template)
  @JoinColumn({ name: 'template_id' })
  template: Template;

  @Column({ type: 'enum', enum: TemplateChannel, default: TemplateChannel.EMAIL })
  channel: TemplateChannel;

  @Column({ name: 'requires_link', type: 'boolean', default: false })
  requiresLink: boolean;

  @Column({ type: 'enum', enum: StepExecutor, default: StepExecutor.PERSON })
  executor: StepExecutor;
}

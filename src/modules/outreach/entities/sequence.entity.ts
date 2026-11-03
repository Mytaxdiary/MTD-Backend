import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SequenceChannel } from '../outreach.enums';
import { SequenceStep } from './sequence-step.entity';

@Entity('outreach_sequences')
export class Sequence extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: SequenceChannel, default: SequenceChannel.EMAIL })
  channel: SequenceChannel;

  @Column({ name: 'audience_rule', type: 'text', nullable: true })
  audienceRule?: string;

  @Column({ name: 'entry_condition', type: 'text', nullable: true })
  entryCondition?: string;

  @Column({ name: 'exit_conditions', type: 'text', nullable: true })
  exitConditions?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => SequenceStep, (s) => s.sequence)
  steps?: SequenceStep[];
}

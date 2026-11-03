import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Sequence } from './sequence.entity';

@Entity('outreach_campaigns')
export class Campaign extends BaseEntity {
  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ name: 'utm_campaign', type: 'varchar', length: 160, nullable: true })
  utmCampaign?: string;

  @Column({ name: 'sequence_id', type: 'char', length: 36 })
  sequenceId: string;

  @ManyToOne(() => Sequence)
  @JoinColumn({ name: 'sequence_id' })
  sequence: Sequence;

  @Column({ name: 'wave_number', type: 'int', default: 1 })
  waveNumber: number;

  @Column({ name: 'wave_started', type: 'date', nullable: true })
  waveStarted?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  arm?: string;

  @Column({ name: 'variable_under_test', type: 'varchar', length: 160, nullable: true })
  variableUnderTest?: string;

  @Column({ name: 'contact_count', type: 'int', default: 0 })
  contactCount: number;

  @Column({ name: 'instantly_campaign_id', type: 'varchar', length: 128, nullable: true })
  instantlyCampaignId?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** When true, wave stays drafted until an admin releases the campaign. */
  @Column({ name: 'release_held', type: 'boolean', default: true })
  releaseHeld: boolean;
}

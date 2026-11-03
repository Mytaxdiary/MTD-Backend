import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SuppressionReason, SuppressionScope, SuppressionValueType } from '../outreach.enums';
import { CrmUser } from './crm-user.entity';
import { Touchpoint } from './touchpoint.entity';

@Entity('outreach_suppressions')
export class Suppression extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  value: string;

  @Column({ name: 'value_type', type: 'enum', enum: SuppressionValueType })
  valueType: SuppressionValueType;

  @Column({ type: 'enum', enum: SuppressionReason })
  reason: SuppressionReason;

  @Column({ name: 'added_at', type: 'datetime', precision: 6 })
  addedAt: Date;

  @Column({ name: 'added_by_user_id', type: 'char', length: 36, nullable: true })
  addedByUserId?: string;

  @ManyToOne(() => CrmUser, { nullable: true })
  @JoinColumn({ name: 'added_by_user_id' })
  addedBy?: CrmUser;

  @Column({ name: 'source_touch_id', type: 'char', length: 36, nullable: true })
  sourceTouchId?: string;

  @ManyToOne(() => Touchpoint, { nullable: true })
  @JoinColumn({ name: 'source_touch_id' })
  sourceTouch?: Touchpoint;

  @Column({
    type: 'enum',
    enum: SuppressionScope,
    default: SuppressionScope.ALL_CHANNELS,
  })
  scope: SuppressionScope;

  @Column({ type: 'varchar', length: 512, nullable: true })
  notes?: string;
}

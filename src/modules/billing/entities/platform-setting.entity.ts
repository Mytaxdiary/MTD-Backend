import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** Key/value platform config (e.g. trial_days). */
@Entity('platform_settings')
export class PlatformSetting extends BaseEntity {
  @Index('UQ_platform_settings_key', { unique: true })
  @Column({ name: 'setting_key', type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'setting_value', type: 'varchar', length: 255 })
  value: string;
}

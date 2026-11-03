import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { RuleGroup } from '../outreach.enums';

@Entity('outreach_rule_configs')
export class RuleConfig extends BaseEntity {
  @Column({ name: 'rule_group', type: 'enum', enum: RuleGroup })
  ruleGroup: RuleGroup;

  @Column({ name: 'rule_code', type: 'varchar', length: 64, unique: true })
  ruleCode: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ name: 'config_json', type: 'json' })
  configJson: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

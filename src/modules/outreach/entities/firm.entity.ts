import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import {
  EntityType,
  FirmSource,
  ListTier,
  PecrLane,
  ProspectStatus,
  SizeBand,
} from '../outreach.enums';
import { CrmUser } from './crm-user.entity';

@Entity('outreach_firms')
export class Firm extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'companies_house_number', type: 'varchar', length: 32, nullable: true })
  companiesHouseNumber?: string;

  @Column({ name: 'entity_type', type: 'enum', enum: EntityType, default: EntityType.UNKNOWN })
  entityType: EntityType;

  @Column({ name: 'pecr_lane', type: 'enum', enum: PecrLane, default: PecrLane.UNKNOWN })
  pecrLane: PecrLane;

  @Column({ name: 'size_band', type: 'enum', enum: SizeBand, default: SizeBand.UNKNOWN })
  sizeBand: SizeBand;

  @Column({ name: 'list_tier', type: 'enum', enum: ListTier, default: ListTier.C_VERIFY })
  listTier: ListTier;

  @Column({ name: 'engaged_flag', type: 'boolean', default: false })
  engagedFlag: boolean;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain?: string;

  @Column({ name: 'linkedin_url', type: 'varchar', length: 512, nullable: true })
  linkedinUrl?: string;

  /** Optional only — not required for MTD outreach. */
  @Column({
    name: 'accounting_software',
    type: 'varchar',
    length: 32,
    default: 'unknown',
  })
  accountingSoftware: string;

  @Column({ type: 'enum', enum: FirmSource, default: FirmSource.OTHER })
  source: FirmSource;

  @Column({ type: 'enum', enum: ProspectStatus, default: ProspectStatus.NEW })
  status: ProspectStatus;

  @Column({ name: 'owner_user_id', type: 'char', length: 36, nullable: true })
  ownerUserId?: string;

  @ManyToOne(() => CrmUser, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner?: CrmUser;

  @Column({ name: 'competitor_incumbent', type: 'varchar', length: 255, nullable: true })
  competitorIncumbent?: string;

  @Column({ name: 'renewal_month', type: 'tinyint', unsigned: true, nullable: true })
  renewalMonth?: number;

  @Column({ name: 'fit_score', type: 'int', nullable: true })
  fitScore?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}

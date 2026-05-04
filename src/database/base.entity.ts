import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * All domain entities extend this class to get standard audit fields.
 * Uses soft-delete via deletedAt so records are never hard-deleted unless explicitly purged.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deletedAt?: Date;
}

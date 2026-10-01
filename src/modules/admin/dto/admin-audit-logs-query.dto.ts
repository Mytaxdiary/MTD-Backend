import { IsIn, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { AdminAuditAction } from '../entities/admin-audit-log.entity';

const AUDIT_ACTIONS = [
  'firm.activate',
  'firm.deactivate',
  'firm.deactivation_reason_update',
  'firm.invalidate_sessions',
  'user.invalidate_sessions',
  'enquiry.update',
] as const satisfies readonly AdminAuditAction[];

export class AdminAuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by action',
    enum: AUDIT_ACTIONS,
  })
  @IsOptional()
  @IsIn([...AUDIT_ACTIONS])
  action?: AdminAuditAction;

  @ApiPropertyOptional({ description: 'Search actor email, target label, or summary' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

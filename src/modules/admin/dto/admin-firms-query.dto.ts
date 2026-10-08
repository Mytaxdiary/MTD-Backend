import { IsIn, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const BILLING_STATUS_FILTERS = ['trial', 'active', 'past_due', 'cancelled', 'expired'] as const;

export class AdminFirmsQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by firm name or owner/contact email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant billing status',
    enum: BILLING_STATUS_FILTERS,
  })
  @IsOptional()
  @IsIn(BILLING_STATUS_FILTERS)
  billingStatus?: (typeof BILLING_STATUS_FILTERS)[number];
}

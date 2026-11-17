import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { SystemErrorSource } from '../entities/system-error-log.entity';

const ERROR_SOURCES = ['hmrc', 'api', 'server'] as const satisfies readonly SystemErrorSource[];

export class AdminErrorsQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by source', enum: ERROR_SOURCES })
  @IsOptional()
  @IsIn([...ERROR_SOURCES])
  source?: SystemErrorSource;

  @ApiPropertyOptional({ description: 'Filter by HTTP / HMRC status code' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @ApiPropertyOptional({ description: 'Created at or after (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Created at or before (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: 'Search endpoint, message, client label, or firm name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

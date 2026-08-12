import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListChaseClientsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by client name / preferred name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter open periods by quarter code',
    enum: ['all', 'Q1', 'Q2', 'Q3', 'Q4'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'Q1', 'Q2', 'Q3', 'Q4'])
  quarter?: string;

  @ApiPropertyOptional({ enum: ['quarter', 'deadline', 'name'], default: 'deadline' })
  @IsOptional()
  @IsString()
  @IsIn(['quarter', 'deadline', 'name'])
  sortBy?: 'quarter' | 'deadline' | 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Authorised clients per page (HMRC fetch scope). */
  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

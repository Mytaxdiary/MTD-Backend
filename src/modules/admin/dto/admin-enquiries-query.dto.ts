import { IsIn, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { EnquiryStatus } from '../../enquiries/entities/enquiry.entity';

export class AdminEnquiriesQueryDto {
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
    description: 'Filter by status',
    enum: ['new', 'contacted', 'closed'],
  })
  @IsOptional()
  @IsIn(['new', 'contacted', 'closed'])
  status?: EnquiryStatus;

  @ApiPropertyOptional({ description: 'Search by name, firm, or email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

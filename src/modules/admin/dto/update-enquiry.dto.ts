import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { EnquiryStatus } from '../../enquiries/entities/enquiry.entity';

export class UpdateEnquiryDto {
  @ApiPropertyOptional({ enum: ['new', 'contacted', 'closed'] })
  @IsOptional()
  @IsIn(['new', 'contacted', 'closed'])
  status?: EnquiryStatus;

  @ApiPropertyOptional({
    description: 'Internal note for support. Pass empty string to clear.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(5000)
  internalNote?: string | null;
}

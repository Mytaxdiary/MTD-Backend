import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Walker & Co Accountants' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  firmName?: string;

  @ApiPropertyOptional({ example: 'Jane Walker' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @ApiPropertyOptional({ example: 'jane@walkerco.co.uk' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({ example: '01234 567890' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: '14 High Street, Slough' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'SL1 1AA' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postcode?: string;
}

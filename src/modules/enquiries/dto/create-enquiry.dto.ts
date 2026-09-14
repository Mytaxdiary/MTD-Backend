import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEnquiryDto {
  @ApiProperty({ example: 'Jane Walker' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Walker & Co Accountants' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  firm: string;

  @ApiProperty({ example: 'jane@walkerco.co.uk' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '07700 900123' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ example: 'We are looking at Growth for about 80 clients.' })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({ example: '/site/contact' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourcePage?: string;

  @ApiPropertyOptional({ example: 'growth' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  planInterest?: string;

  /** Honeypot — leave empty. Bots that fill it are silently ignored. */
  @ApiPropertyOptional({ description: 'Honeypot field; must be empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

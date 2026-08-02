import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'BZ394384A', description: '9-character NINO without spaces' })
  @IsString()
  @Matches(/^[A-Z]{2}\d{6}[A-D]$/i, {
    message: 'NINO must be 2 letters, 6 digits, 1 letter (e.g. BZ394384A)',
  })
  nino: string;

  @ApiProperty({ example: 'TS24 1PA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postcode: string;

  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ required: false, enum: ['main', 'supporting'], default: 'main' })
  @IsOptional()
  @IsIn(['main', 'supporting'])
  agentType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  personalMessage?: string;

  @ApiProperty({ required: false, example: '1234567890', description: '10-digit UTR' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'UTR must be exactly 10 digits' })
  utr?: string;
}

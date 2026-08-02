import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiProperty({ required: false, example: '1234567890', description: '10-digit UTR' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'UTR must be exactly 10 digits' })
  utr?: string;
}

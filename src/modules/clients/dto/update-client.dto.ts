import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiProperty({
    required: false,
    example: 'Thomas Harris',
    description: 'Client full name as shown in lists and detail.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, example: '1234567890', description: '10-digit UTR' })
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v != null)
  @IsString()
  @Matches(/^\d{10}$/, { message: 'UTR must be exactly 10 digits' })
  utr?: string;

  @ApiProperty({
    required: false,
    example: 'Tom',
    description: 'Preferred name for chase greetings. Empty string clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  preferredName?: string;
}

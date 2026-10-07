import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ClearTrialDomainDto {
  @ApiProperty({ example: 'neweffect.co.uk', description: 'Corporate email domain to unlock' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain: string;
}

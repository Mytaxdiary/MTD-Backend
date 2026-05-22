import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResendInvitationDto {
  @ApiPropertyOptional({ description: 'Optional personal message; {name} is replaced with client name' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  personalMessage?: string;
}

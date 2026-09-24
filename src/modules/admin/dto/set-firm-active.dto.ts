import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetFirmActiveDto {
  @ApiProperty({ description: 'true = activate, false = deactivate' })
  @IsBoolean()
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Optional reason/note stored when deactivating (cleared on activate)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

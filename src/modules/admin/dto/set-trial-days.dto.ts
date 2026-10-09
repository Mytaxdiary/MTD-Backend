import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class SetTrialDaysDto {
  @ApiProperty({
    example: 7,
    description:
      'Default free-trial length in days for new firm signups (0–365). 0 means no free trial.',
    minimum: 0,
    maximum: 365,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  days: number;
}

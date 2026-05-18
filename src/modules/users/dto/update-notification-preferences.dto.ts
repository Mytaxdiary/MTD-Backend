import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() chaseEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() chaseSms?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() overdueAlert?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() deadlineReminder?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() inviteAccepted?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() liabilityAlert?: boolean;

  @ApiPropertyOptional({ enum: [7, 14, 21, 30] })
  @IsOptional()
  @IsInt()
  @IsIn([7, 14, 21, 30])
  reminderDays?: number;
}

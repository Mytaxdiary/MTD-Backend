import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListClientsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Clients per page (max 100)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /**
   * Filter by invitation/authorisation status.
   * Values: all | pending | filed | invite-accepted | partial-auth | rejected | expired
   */
  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;

  /** Case-insensitive substring match on client name or NINO. */
  @ApiPropertyOptional({ example: 'Sarah' })
  @IsOptional()
  @IsString()
  search?: string;
}

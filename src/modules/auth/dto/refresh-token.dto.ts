import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token issued at login' })
  @IsString()
  refreshToken: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to revoke (revokes all if omitted)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

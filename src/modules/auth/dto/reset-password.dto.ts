import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Aligns with frontend reset-password page: sends { token, password } */
export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token received from the email link' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewSecur3P@ss!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

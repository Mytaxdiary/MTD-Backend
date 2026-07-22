import { IsString, MinLength, IsOptional, Length } from 'class-validator';

export class DeletionRequestDto {
  @IsString()
  @MinLength(1)
  password: string;

  /** TOTP code — required when MFA is enabled on the account. */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  mfaCode?: string;
}

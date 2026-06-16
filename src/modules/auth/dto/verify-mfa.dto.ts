import { IsString, Length } from 'class-validator';

export class VerifyMfaDto {
  /** Short-lived MFA challenge token returned by POST /auth/login when MFA is required */
  @IsString()
  mfaToken: string;

  /** 6-digit TOTP code from the authenticator app */
  @IsString()
  @Length(6, 6)
  code: string;
}

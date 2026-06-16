import { IsString, Length } from 'class-validator';

export class EnableMfaDto {
  /** Short-lived setup token returned by GET /auth/mfa/setup */
  @IsString()
  setupToken: string;

  /** 6-digit TOTP code from the authenticator app */
  @IsString()
  @Length(6, 6)
  code: string;
}

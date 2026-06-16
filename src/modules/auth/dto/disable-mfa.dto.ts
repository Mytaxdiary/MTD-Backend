import { IsString, Length, MinLength } from 'class-validator';

export class DisableMfaDto {
  @IsString()
  @MinLength(8)
  password: string;

  /** 6-digit TOTP code to confirm identity before disabling */
  @IsString()
  @Length(6, 6)
  code: string;
}

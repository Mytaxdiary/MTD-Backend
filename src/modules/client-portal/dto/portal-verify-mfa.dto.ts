import { IsString, Length } from 'class-validator';

export class PortalVerifyMfaDto {
  @IsString()
  mfaToken: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

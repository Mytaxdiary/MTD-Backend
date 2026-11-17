import { IsString, Length } from 'class-validator';

export class PortalEnableMfaDto {
  @IsString()
  setupToken: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

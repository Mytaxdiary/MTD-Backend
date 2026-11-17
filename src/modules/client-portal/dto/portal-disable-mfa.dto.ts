import { IsString, Length, MinLength } from 'class-validator';

export class PortalDisableMfaDto {
  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

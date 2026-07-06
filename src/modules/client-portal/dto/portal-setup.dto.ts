import { IsString, MinLength } from 'class-validator';

export class PortalSetupDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

import { IsString } from 'class-validator';

export class PortalPreviewExchangeDto {
  @IsString()
  token: string;
}

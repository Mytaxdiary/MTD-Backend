import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Client → accountant portal message. Subject defaults on the server if omitted. */
export class ClientPortalReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}

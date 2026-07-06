import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendPortalMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  subject: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  body: string;
}

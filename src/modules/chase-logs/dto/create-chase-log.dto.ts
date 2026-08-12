import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChaseLogDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  /** HMRC business id — scopes this chase to one business row */
  @IsString()
  @IsOptional()
  @MaxLength(64)
  businessId?: string;

  /** Trading name snapshot for history / templates */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  businessName?: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsIn(['email', 'sms'])
  channel: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}

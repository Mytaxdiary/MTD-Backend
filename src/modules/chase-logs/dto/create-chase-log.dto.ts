import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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

  /** Obligation period start (YYYY-MM-DD) */
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStartDate?: string;

  /** Obligation period end (YYYY-MM-DD) */
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEndDate?: string;

  /** HMRC due date (YYYY-MM-DD) */
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  /** e.g. Q1 2025–26 */
  @IsString()
  @IsOptional()
  @MaxLength(32)
  quarterLabel?: string;

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

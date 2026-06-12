import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const CHASE_TEMPLATE_TYPES = ['bookkeeping', 'data-request', 'general'] as const;
export type ChaseTemplateType = (typeof CHASE_TEMPLATE_TYPES)[number];

export class CreateChaseTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsIn(CHASE_TEMPLATE_TYPES)
  type: ChaseTemplateType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}

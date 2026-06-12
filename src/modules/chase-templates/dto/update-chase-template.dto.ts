import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CHASE_TEMPLATE_TYPES, ChaseTemplateType } from './create-chase-template.dto';

export class UpdateChaseTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(CHASE_TEMPLATE_TYPES)
  type?: ChaseTemplateType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

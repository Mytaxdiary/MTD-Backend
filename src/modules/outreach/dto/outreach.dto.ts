import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ProspectStatus,
  SuppressionReason,
  SuppressionScope,
  SuppressionValueType,
  TaskStatus,
  TaskType,
  TouchChannel,
  TouchDirection,
  TouchEventType,
  ResponseCategory,
  LinkAsset,
  TemplateChannel,
  SequenceChannel,
  StepExecutor,
} from '../outreach.enums';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}

export class CreateFirmDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  domain?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(512)
  website?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateFirmDto extends PartialType(CreateFirmDto) {
  @ApiPropertyOptional({ enum: ProspectStatus })
  @IsEnum(ProspectStatus)
  @IsOptional()
  status?: ProspectStatus;
}

export class CreateContactDto {
  @ApiProperty()
  @IsUUID()
  firmId!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recipientId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(64)
  salutation?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  currentSequenceId?: string;
}

export class UpdateContactDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(64)
  salutation?: string;

  @ApiPropertyOptional({ enum: ProspectStatus })
  @IsEnum(ProspectStatus)
  @IsOptional()
  status?: ProspectStatus;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  doNotContact?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  sendHeld?: boolean;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  currentSequenceId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ContactsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  firmId?: string;

  @ApiPropertyOptional({ enum: ProspectStatus })
  @IsEnum(ProspectStatus)
  @IsOptional()
  status?: ProspectStatus;
}

export class CreateTouchpointDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  firmId?: string;

  @ApiProperty({ enum: TouchChannel })
  @IsEnum(TouchChannel)
  channel!: TouchChannel;

  @ApiProperty({ enum: TouchDirection })
  @IsEnum(TouchDirection)
  direction!: TouchDirection;

  @ApiProperty({ enum: TouchEventType })
  @IsEnum(TouchEventType)
  eventType!: TouchEventType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(512)
  summary?: string;

  @ApiPropertyOptional({ enum: ResponseCategory })
  @IsEnum(ResponseCategory)
  @IsOptional()
  responseCategory?: ResponseCategory;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sequenceId?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  stepNumber?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  campaignId?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'E1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  handbookCode!: string;

  @ApiPropertyOptional({ default: '1.0' })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  version?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ enum: TemplateChannel })
  @IsEnum(TemplateChannel)
  @IsOptional()
  channel?: TemplateChannel;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(512)
  subject?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ enum: LinkAsset })
  @IsEnum(LinkAsset)
  @IsOptional()
  linkAsset?: LinkAsset;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class CreateSequenceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: SequenceChannel })
  @IsEnum(SequenceChannel)
  @IsOptional()
  channel?: SequenceChannel;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  audienceRule?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entryCondition?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  exitConditions?: string;
}

export class UpdateSequenceDto extends PartialType(CreateSequenceDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateSequenceStepDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  stepNumber!: number;

  @ApiProperty()
  @IsUUID()
  templateId!: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  dayOffset?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  triggerEvent?: string;

  @ApiPropertyOptional({ enum: TemplateChannel })
  @IsEnum(TemplateChannel)
  @IsOptional()
  channel?: TemplateChannel;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  requiresLink?: boolean;

  @ApiPropertyOptional({ enum: StepExecutor })
  @IsEnum(StepExecutor)
  @IsOptional()
  executor?: StepExecutor;
}

export class CreateSuppressionDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  value!: string;

  @ApiProperty({ enum: SuppressionValueType })
  @IsEnum(SuppressionValueType)
  valueType!: SuppressionValueType;

  @ApiProperty({ enum: SuppressionReason })
  @IsEnum(SuppressionReason)
  reason!: SuppressionReason;

  @ApiPropertyOptional({ enum: SuppressionScope })
  @IsEnum(SuppressionScope)
  @IsOptional()
  scope?: SuppressionScope;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(512)
  notes?: string;
}

export class SuppressionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SuppressionValueType })
  @IsEnum(SuppressionValueType)
  @IsOptional()
  valueType?: SuppressionValueType;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  skipReason?: string;

  @ApiPropertyOptional({ enum: TaskType })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;
}

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsUUID()
  sequenceId!: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  waveNumber?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  utmCampaign?: string;
}

export class AssignSequenceDto {
  @ApiProperty()
  @IsUUID()
  sequenceId!: string;
}

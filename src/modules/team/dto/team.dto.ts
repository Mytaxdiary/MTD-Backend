import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StaffPermissionsDto {
  @ApiProperty()
  @IsBoolean()
  canAddClients: boolean;

  @ApiProperty()
  @IsBoolean()
  canChase: boolean;

  @ApiProperty()
  @IsBoolean()
  canViewLiabilities: boolean;

  @ApiProperty()
  @IsBoolean()
  canViewNotes: boolean;

  @ApiProperty()
  @IsBoolean()
  canManageTemplates: boolean;

  @ApiProperty()
  @IsBoolean()
  canViewSettings: boolean;

  @ApiProperty()
  @IsBoolean()
  canInviteStaff: boolean;
}

export class InviteStaffDto {
  @ApiProperty({ example: 'Suki' })
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Patel' })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'suki@walkerco.co.uk' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ type: StaffPermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StaffPermissionsDto)
  @IsObject()
  permissions?: StaffPermissionsDto;
}

export class UpdateStaffPermissionsDto {
  @ApiProperty({ type: StaffPermissionsDto })
  @ValidateNested()
  @Type(() => StaffPermissionsDto)
  @IsObject()
  permissions: StaffPermissionsDto;
}

export class AcceptStaffInviteDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

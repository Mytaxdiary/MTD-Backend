import { IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignClientDto {
  @ApiProperty({
    nullable: true,
    description: 'Staff user id to assign, or null to unassign',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedToUserId: string | null;
}

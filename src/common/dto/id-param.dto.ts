import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IdParamDto {
  @ApiProperty({ description: 'Resource UUID', format: 'uuid' })
  @IsUUID()
  id: string;
}

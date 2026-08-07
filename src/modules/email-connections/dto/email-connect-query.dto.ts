import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class EmailConnectQueryDto {
  @ApiProperty({ enum: ['gmail', 'outlook'] })
  @IsIn(['gmail', 'outlook'])
  provider: 'gmail' | 'outlook';
}

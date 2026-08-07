import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class EmailCallbackDto {
  @ApiProperty({ example: '4/0AeanS...' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ enum: ['gmail', 'outlook'] })
  @IsIn(['gmail', 'outlook'])
  provider: 'gmail' | 'outlook';
}

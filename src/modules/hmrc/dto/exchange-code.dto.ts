import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeCodeDto {
  @ApiProperty({ description: 'Authorization code returned by HMRC OAuth redirect' })
  @IsString()
  code: string;
}

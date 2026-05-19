import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateArnDto {
  @ApiProperty({ description: 'Agent Reference Number (e.g. EARN0713416)', example: 'EARN0713416' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  arn: string;
}

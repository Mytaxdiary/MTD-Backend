import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'jane@walkerco.co.uk' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '••••••••' })
  @IsString()
  password: string;
}

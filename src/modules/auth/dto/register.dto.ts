import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Aligns with the frontend register form: firstName, lastName, practiceName, email, password */
export class RegisterDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Walker' })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'Walker & Co Accountants' })
  @IsString()
  @MaxLength(200)
  practiceName: string;

  @ApiProperty({ example: 'jane@walkerco.co.uk' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Secur3P@ss!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

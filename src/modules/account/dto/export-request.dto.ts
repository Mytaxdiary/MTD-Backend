import { IsString, MinLength } from 'class-validator';

export class ExportRequestDto {
  @IsString()
  @MinLength(1)
  password: string;
}

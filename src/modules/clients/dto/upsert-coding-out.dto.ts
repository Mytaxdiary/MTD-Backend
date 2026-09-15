import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** HMRC requires both id and amount on each coding-out component. */
class CodingOutAmountDto {
  @ApiProperty({ example: 1234567890, description: 'Component identifier required by HMRC' })
  @IsInt()
  @Min(1)
  @Max(999999999999999)
  id: number;

  @ApiProperty({ example: 100.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999999.99)
  amount: number;
}

class CodingOutTaxCodeComponentsDto {
  @ApiPropertyOptional({ type: [CodingOutAmountDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CodingOutAmountDto)
  payeUnderpayment?: CodingOutAmountDto[];

  @ApiPropertyOptional({ type: [CodingOutAmountDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CodingOutAmountDto)
  selfAssessmentUnderpayment?: CodingOutAmountDto[];

  @ApiPropertyOptional({ type: [CodingOutAmountDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CodingOutAmountDto)
  debt?: CodingOutAmountDto[];

  /** Single object in HMRC schema (not an array). */
  @ApiPropertyOptional({ type: CodingOutAmountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodingOutAmountDto)
  inYearAdjustment?: CodingOutAmountDto;
}

/** PUT body for Create or Amend Coding Out Underpayments and Debt Amounts */
export class UpsertCodingOutDto {
  @ApiProperty({ type: CodingOutTaxCodeComponentsDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CodingOutTaxCodeComponentsDto)
  taxCodeComponents: CodingOutTaxCodeComponentsDto;
}

import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsObject, Min, ValidateNested } from 'class-validator';

export class SeCumulativePeriodDatesDto {
  @IsDateString()
  periodStartDate: string;

  @IsDateString()
  periodEndDate: string;
}

export class SeCumulativePeriodIncomeDto {
  @IsNumber()
  @Min(0)
  turnover: number;

  @IsNumber()
  @Min(0)
  other: number;
}

export class SeCumulativePeriodExpensesDto {
  @IsNumber()
  consolidatedExpenses: number;
}

export class CreateSeCumulativeDto {
  @ValidateNested()
  @Type(() => SeCumulativePeriodDatesDto)
  @IsObject()
  periodDates: SeCumulativePeriodDatesDto;

  @ValidateNested()
  @Type(() => SeCumulativePeriodIncomeDto)
  @IsObject()
  periodIncome: SeCumulativePeriodIncomeDto;

  @ValidateNested()
  @Type(() => SeCumulativePeriodExpensesDto)
  @IsObject()
  periodExpenses: SeCumulativePeriodExpensesDto;
}

import { IsDateString, IsNumber, Min } from 'class-validator';

export class CreateUkPropertyCumulativeDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsNumber()
  @Min(0)
  periodAmount: number;

  @IsNumber()
  consolidatedExpenses: number;
}

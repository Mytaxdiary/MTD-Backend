import { IsOptional, IsString, Matches } from 'class-validator';

export class GetPaymentsAndAllocationsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @IsOptional()
  @IsString()
  paymentLot?: string;

  @IsOptional()
  @IsString()
  paymentLotItem?: string;
}

/** Default 2-year date range for payment history (max 732 days). */
export function defaultPaymentsDateRange(): { fromDate: string; toDate: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 730);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { normalizeTaxYear } from '../tax-year.util';

export class GetCrystallisationObligationsQueryDto {
  @IsOptional()
  @IsString()
  taxYear?: string;

  @IsOptional()
  @IsString()
  @IsIn(['open', 'fulfilled'])
  status?: string;
}

/** Normalise optional tax year for HMRC crystallisation query */
export function crystallisationTaxYearParam(taxYear?: string): string | undefined {
  if (!taxYear?.trim()) return undefined;
  return normalizeTaxYear(taxYear.trim());
}

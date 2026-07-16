import { IsOptional, IsString, Matches } from 'class-validator';

/** Current UK tax year e.g. "2024-25". Defaults to the running tax year if omitted. */
function currentUkTaxYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const day = now.getDate();
  // UK tax year starts 6 April. Before 6 April → current year is the closing year.
  const startYear = month < 4 || (month === 4 && day < 6) ? year - 1 : year;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export { currentUkTaxYear };

export class GetIncomeSummaryQueryDto {
  /** Tax year in HMRC format, e.g. 2024-25. Defaults to the current running tax year. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'taxYear must be in YYYY-YY format, e.g. 2024-25' })
  taxYear?: string;
}

import { BadRequestException } from '@nestjs/common';

/** Normalises tax year to HMRC format YYYY-YY (e.g. 2024-25). */
export function normalizeTaxYear(raw: string): string {
  const trimmed = raw.trim();

  const longForm = trimmed.match(/^(\d{4})-(\d{4})$/);
  if (longForm) {
    const start = longForm[1];
    const endShort = longForm[2].slice(2);
    return `${start}-${endShort}`;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [start, end] = trimmed.split('-');
    const startNum = Number(start);
    const endNum = Number(end);
    const expectedEnd = (startNum + 1) % 100;
    if (endNum !== expectedEnd) {
      throw new BadRequestException(
        `Invalid tax year "${trimmed}". End year must be ${String(expectedEnd).padStart(2, '0')} for ${start}.`,
      );
    }
    return trimmed;
  }

  throw new BadRequestException('Invalid tax year format. Use e.g. 2024-25 (not 2024-2025).');
}

/** Current UK tax year label (6 April boundary). */
export function currentUkTaxYear(): string {
  const now = new Date();
  let startYear = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  if (month < 3 || (month === 3 && day < 6)) {
    startYear -= 1;
  }
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

/** Tax year start (6 Apr) through the latest completed standard quarter end. */
export function latestCompletedCumulativePeriod(
  taxYear: string,
  now = new Date(),
): { periodStartDate: string; periodEndDate: string } {
  const startYear = parseInt(taxYear.split('-')[0] ?? '', 10);
  if (!Number.isFinite(startYear)) {
    throw new BadRequestException('Invalid tax year for cumulative period dates.');
  }
  const periodStartDate = `${startYear}-04-06`;
  const quarterEnds = [
    `${startYear}-07-05`,
    `${startYear}-10-05`,
    `${startYear + 1}-01-05`,
    `${startYear + 1}-04-05`,
  ];
  const today = now.toISOString().slice(0, 10);
  let periodEndDate = quarterEnds[0];
  for (const end of quarterEnds) {
    if (end <= today) periodEndDate = end;
  }
  return { periodStartDate, periodEndDate };
}

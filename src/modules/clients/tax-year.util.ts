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

  throw new BadRequestException(
    'Invalid tax year format. Use e.g. 2024-25 (not 2024-2025).',
  );
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

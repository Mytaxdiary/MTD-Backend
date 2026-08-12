import {
  daysBetween,
  quarterLabelFromPeriodStart,
  ukQuarterCodeFromPeriodStart,
} from './chase-template-vars.util';

describe('chase quarter helpers', () => {
  it('maps period starts to Q1–Q4', () => {
    expect(ukQuarterCodeFromPeriodStart('2025-04-06')).toBe('Q1');
    expect(ukQuarterCodeFromPeriodStart('2025-07-06')).toBe('Q2');
    expect(ukQuarterCodeFromPeriodStart('2025-10-06')).toBe('Q3');
    expect(ukQuarterCodeFromPeriodStart('2026-01-06')).toBe('Q4');
  });

  it('builds quarter labels with tax year', () => {
    expect(quarterLabelFromPeriodStart('2025-04-06')).toBe('Q1 2025–26');
    expect(quarterLabelFromPeriodStart('2026-01-06')).toBe('Q4 2025–26');
  });

  it('daysBetween uses calendar days', () => {
    const due = '2026-08-01';
    const now = new Date('2026-08-08T12:00:00Z');
    expect(daysBetween(due, now)).toBe(7);
  });
});

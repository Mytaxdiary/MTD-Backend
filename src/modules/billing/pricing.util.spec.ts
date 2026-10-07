import { calcMonthlyFee, extraClientRateGbp } from './pricing.util';

describe('calcMonthlyFee', () => {
  it('charges base £50 for 10 clients (under allowance)', () => {
    const q = calcMonthlyFee(10);
    expect(q.billableClients).toBe(10);
    expect(q.includedClients).toBe(10);
    expect(q.extraClients).toBe(0);
    expect(q.baseGbp).toBe(50);
    expect(q.extrasGbp).toBe(0);
    expect(q.totalExVatGbp).toBe(50);
  });

  it('charges base £50 for exactly 50 clients', () => {
    const q = calcMonthlyFee(50);
    expect(q.extraClients).toBe(0);
    expect(q.totalExVatGbp).toBe(50);
  });

  it('adds 90p for the 51st client', () => {
    const q = calcMonthlyFee(51);
    expect(q.extraClients).toBe(1);
    expect(q.extrasGbp).toBe(0.9);
    expect(q.totalExVatGbp).toBe(50.9);
  });

  it('matches the 120-client example (£111)', () => {
    const q = calcMonthlyFee(120);
    expect(q.extraClients).toBe(70);
    expect(q.bands).toEqual([
      {
        fromClient: 51,
        toClient: 100,
        count: 50,
        rateGbp: 0.9,
        subtotalGbp: 45,
      },
      {
        fromClient: 101,
        toClient: 120,
        count: 20,
        rateGbp: 0.8,
        subtotalGbp: 16,
      },
    ]);
    expect(q.totalExVatGbp).toBe(111);
  });

  it('floors extra rate at 50p for large books', () => {
    expect(extraClientRateGbp(251)).toBe(0.5);
    expect(extraClientRateGbp(301)).toBe(0.5);
    expect(extraClientRateGbp(999)).toBe(0.5);

    const q = calcMonthlyFee(300);
    const lastBand = q.bands[q.bands.length - 1];
    expect(lastBand.rateGbp).toBe(0.5);
  });

  it('returns zero total for zero clients', () => {
    const q = calcMonthlyFee(0);
    expect(q.baseGbp).toBe(0);
    expect(q.totalExVatGbp).toBe(0);
  });
});

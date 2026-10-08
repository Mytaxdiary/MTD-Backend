import { BillingPublicController } from './billing-public.controller';

describe('BillingPublicController', () => {
  const controller = new BillingPublicController();

  it('estimates the monthly fee for a plain client count', () => {
    const result = controller.estimate('120');
    expect(result.totalExVatGbp).toBe(111);
    expect(result.billableClients).toBe(120);
  });

  it('defaults to 0 clients when the query param is missing', () => {
    const result = controller.estimate(undefined);
    expect(result.billableClients).toBe(0);
    expect(result.totalExVatGbp).toBe(0);
  });

  it('clamps negative / garbage input to 0 instead of throwing', () => {
    expect(controller.estimate('-5').billableClients).toBe(0);
    expect(controller.estimate('not-a-number').billableClients).toBe(0);
  });

  it('clamps absurdly large input at 100000 so the response stays sane', () => {
    const result = controller.estimate('999999999');
    expect(result.billableClients).toBe(100000);
  });

  it('matches calcMonthlyFee exactly for 50 and 51 clients (boundary)', () => {
    expect(controller.estimate('50').totalExVatGbp).toBe(50);
    expect(controller.estimate('51').totalExVatGbp).toBe(50.9);
  });
});

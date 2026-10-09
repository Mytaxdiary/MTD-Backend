/**
 * Shared pricing math — keep in sync with marketing / Settings displays.
 * Amounts are GBP.
 */

import {
  BILLING_BAND_SIZE,
  BILLING_BASE_GBP,
  BILLING_EXTRA_FLOOR_GBP,
  BILLING_EXTRA_START_GBP,
  BILLING_INCLUDED_CLIENTS,
} from './billing.constants';

export interface PricingBandLine {
  fromClient: number;
  toClient: number;
  count: number;
  rateGbp: number;
  subtotalGbp: number;
}

export interface MonthlyFeeQuote {
  billableClients: number;
  includedClients: number;
  extraClients: number;
  baseGbp: number;
  extrasGbp: number;
  bands: PricingBandLine[];
  totalExVatGbp: number;
}

/** Rate for an extra client at 1-based absolute client number (51 → 0.90, …). */
export function extraClientRateGbp(absoluteClientNumber: number): number {
  if (absoluteClientNumber <= BILLING_INCLUDED_CLIENTS) return 0;
  const extraIndex = absoluteClientNumber - BILLING_INCLUDED_CLIENTS - 1; // 0 for client 51
  const band = Math.floor(extraIndex / BILLING_BAND_SIZE);
  const rate = BILLING_EXTRA_START_GBP - band * 0.1;
  return Math.max(BILLING_EXTRA_FLOOR_GBP, Number(rate.toFixed(2)));
}

export function calcMonthlyFee(billableClients: number): MonthlyFeeQuote {
  const n = Math.max(0, Math.floor(billableClients));
  const included = Math.min(n, BILLING_INCLUDED_CLIENTS);
  const extraClients = Math.max(0, n - BILLING_INCLUDED_CLIENTS);
  const bands: PricingBandLine[] = [];

  if (extraClients > 0) {
    let i = BILLING_INCLUDED_CLIENTS + 1;
    while (i <= n) {
      const rate = extraClientRateGbp(i);
      let j = i;
      while (j + 1 <= n && extraClientRateGbp(j + 1) === rate) j++;
      const count = j - i + 1;
      bands.push({
        fromClient: i,
        toClient: j,
        count,
        rateGbp: rate,
        subtotalGbp: Number((count * rate).toFixed(2)),
      });
      i = j + 1;
    }
  }

  const extrasGbp = Number(bands.reduce((s, b) => s + b.subtotalGbp, 0).toFixed(2));
  const baseGbp = n > 0 ? BILLING_BASE_GBP : 0;

  return {
    billableClients: n,
    includedClients: included,
    extraClients,
    baseGbp,
    extrasGbp,
    bands,
    totalExVatGbp: Number((baseGbp + extrasGbp).toFixed(2)),
  };
}

/**
 * HMRC Business Income Source Summary (BISS) v3.0
 * GET /income-tax/income-sources/business-source-summary/{nino}/{taxYear}/{incomeSourceId}/{typeOfBusiness}
 */

export interface BissIncome {
  turnover?: number;
  other?: number;
  totalIncome?: number;
}

export interface BissExpenses {
  costOfGoods?: number;
  paymentsToSubcontractors?: number;
  wagesAndStaffCosts?: number;
  carVanTravelExpenses?: number;
  premisesRunningCosts?: number;
  maintenanceCosts?: number;
  adminCosts?: number;
  businessEntertainmentCosts?: number;
  advertisingCosts?: number;
  interestOnBankOtherLoans?: number;
  financeCharges?: number;
  irrecoverableDebts?: number;
  professionalFees?: number;
  depreciation?: number;
  otherExpenses?: number;
  consolidatedExpenses?: number;
  totalExpenses?: number;
}

export interface BissTotal {
  income?: BissIncome;
  expenses?: BissExpenses;
}

export interface BissNetFigure {
  net?: number;
  totalAdditions?: number;
  totalDeductions?: number;
}

/** Raw HMRC BISS response for a single income source. */
export interface BissResponse {
  total?: BissTotal;
  profit?: BissNetFigure;
  loss?: BissNetFigure;
}

/** Aggregated YTD summary across all businesses, returned by our endpoint. */
export interface IncomeSummaryResponse {
  taxYear: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  netLoss: number;
  /** Per-business breakdown for display */
  businesses: IncomeSummaryBusiness[];
}

export interface IncomeSummaryBusiness {
  businessId: string;
  typeOfBusiness: string;
  tradingName?: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  netLoss: number;
}

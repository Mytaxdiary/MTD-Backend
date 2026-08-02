/** Normalised period / cumulative submission figures for UI. */
export interface SubmittedPeriodFigure {
  /** e.g. Q1, Q2, or "YTD cumulative" */
  label: string;
  periodStartDate?: string;
  periodEndDate?: string;
  periodId?: string;
  businessId: string;
  typeOfBusiness: string;
  tradingName?: string;
  income: number;
  expenses: number;
  net: number;
  /** true when sourced from TY 2025-26+ cumulative endpoint */
  cumulative?: boolean;
}

export interface SubmittedFiguresResponse {
  taxYear: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  netLoss: number;
  periods: SubmittedPeriodFigure[];
  businesses: Array<{
    businessId: string;
    typeOfBusiness: string;
    tradingName?: string;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    netLoss: number;
  }>;
}

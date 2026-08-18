import type { SubmittedPeriodFigure } from './hmrc-period-summaries.types';

export interface UkPropertyMoneyBlock {
  income?: Record<string, unknown>;
  expenses?: Record<string, unknown>;
  adjustments?: Record<string, unknown>;
  allowances?: Record<string, unknown>;
}

export interface UkPropertyAnnualSubmission {
  submittedOn?: string;
  ukProperty?: UkPropertyMoneyBlock;
  ukFhlProperty?: UkPropertyMoneyBlock;
  ukNonFhlProperty?: UkPropertyMoneyBlock;
}

export interface UkPropertyFiguresResponse {
  taxYear: string;
  businessId: string;
  typeOfBusiness: string;
  tradingName?: string;
  fromDate?: string;
  toDate?: string;
  submittedOn?: string;
  income: number;
  expenses: number;
  net: number;
  periods: SubmittedPeriodFigure[];
  annual: UkPropertyAnnualSubmission | null;
}

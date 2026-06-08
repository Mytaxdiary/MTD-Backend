/** HMRC Self Assessment Accounts (MTD) v4.0 — balance and transactions */
export interface HmrcLatePaymentInterest {
  accruingInterestAmount?: number;
  interestOutstandingAmount?: number;
  interestAmount?: number;
}

export interface HmrcAccountDocumentDetail {
  taxYear?: string;
  documentId?: string;
  documentDate?: string;
  documentText?: string;
  documentDueDate?: string;
  documentDescription?: string;
  originalAmount?: number;
  outstandingAmount?: number;
  creditReason?: string;
  isChargeEstimate?: boolean;
  latePaymentInterest?: HmrcLatePaymentInterest;
}

export interface HmrcBalanceDetails {
  payableAmount?: number;
  payableDueDate?: string;
  pendingChargeDueAmount?: number;
  overdueAmount?: number;
  totalBalance?: number;
  totalBcdBalance?: number;
  unallocatedCredit?: number;
  availableCredit?: number;
}

export interface BalanceAndTransactionsResponse {
  balanceDetails?: HmrcBalanceDetails;
  documentDetails?: HmrcAccountDocumentDetail[];
  codingDetails?: unknown[];
  financialDetails?: unknown[];
}

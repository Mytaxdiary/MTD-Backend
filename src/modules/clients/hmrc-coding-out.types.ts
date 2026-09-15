/** HMRC SA Accounts v4.0 — Coding Out Underpayments and Debts */

export type CodingOutAmountSource = 'HMRC HELD' | 'CUSTOMER' | 'user' | 'hmrcHeld' | string;

export interface CodingOutAmountItem {
  amount: number;
  id?: number;
  source?: CodingOutAmountSource;
  relatedTaxYear?: string;
  submittedOn?: string;
}

export interface CodingOutTaxCodeComponents {
  payeUnderpayment?: CodingOutAmountItem[];
  selfAssessmentUnderpayment?: CodingOutAmountItem[];
  debt?: CodingOutAmountItem[];
  /** Single object in HMRC schema */
  inYearAdjustment?: CodingOutAmountItem;
}

export interface CodingOutUnmatchedCustomerSubmissions {
  payeUnderpayment?: CodingOutAmountItem[];
  selfAssessmentUnderpayment?: CodingOutAmountItem[];
  debt?: CodingOutAmountItem[];
  inYearAdjustment?: CodingOutAmountItem;
}

/** GET .../collection/tax-code response */
export interface CodingOutUnderpaymentsResponse {
  taxCodeComponents?: CodingOutTaxCodeComponents;
  unmatchedCustomerSubmissions?: CodingOutUnmatchedCustomerSubmissions;
  /** Legacy / alternate key some payloads may use */
  unmatchedCustomerInfo?: { amount?: number; source?: string };
}

/** PUT .../collection/tax-code body — id + amount required on every component */
export interface CodingOutUnderpaymentsWriteBody {
  taxCodeComponents: {
    payeUnderpayment?: Array<{ id: number; amount: number }>;
    selfAssessmentUnderpayment?: Array<{ id: number; amount: number }>;
    debt?: Array<{ id: number; amount: number }>;
    inYearAdjustment?: { id: number; amount: number };
  };
}

/** GET .../coding-out/status */
export interface CodingOutStatusResponse {
  processingDate: string;
  nino: string;
  taxYear: string;
  /** true = opted out; false = opted in */
  optOutIndicator: boolean;
}

/** GET .../penalties — key fields used by UI (full HMRC payload may include more) */
export interface ItsaPenaltiesTotalisations {
  lateSubmissionPenaltyTotalValue?: number;
  penalisedPrincipalTotal?: number;
  latePaymentPenaltyPostedTotal?: number;
  latePaymentPenaltyEstimateTotal?: number;
}

export interface ItsaLateSubmissionPenaltySummary {
  activePenaltyPoints?: number;
  inactivePenaltyPoints?: number;
  periodOfComplianceAchievement?: string;
  regimeThreshold?: number;
  penaltyChargeAmount?: number;
}

export interface ItsaLateSubmissionDetail {
  penaltyChargeReference?: string;
  penaltyStatus?: string;
  penaltyCategory?: string;
  penaltyChargeCreationDate?: string;
  penaltyChargeDueDate?: string;
  penaltyChargeAmount?: number;
  lateSubmissions?: Array<{
    lateSubmissionId?: string;
    taxPeriodStartDate?: string;
    taxPeriodEndDate?: string;
    taxPeriodDueDate?: string;
    returnReceiptDate?: string;
    taxReturnStatus?: string;
  }>;
}

export interface ItsaLatePaymentPenaltyDetail {
  principalChargeReference?: string;
  penaltyChargeReference?: string;
  penaltyCategory?: string;
  penaltyStatus?: string;
  penaltyChargeCreationDate?: string;
  penaltyChargeDueDate?: string;
  penaltyChargeAmount?: number;
}

export interface ItsaPenaltiesResponse {
  totalisations?: ItsaPenaltiesTotalisations;
  lateSubmissionPenalty?: {
    summary?: ItsaLateSubmissionPenaltySummary;
    details?: ItsaLateSubmissionDetail[];
  };
  latePaymentPenalty?: {
    details?: ItsaLatePaymentPenaltyDetail[];
  };
}

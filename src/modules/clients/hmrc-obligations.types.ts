/** HMRC Obligations (MTD) v3.0 — income and expenditure */
export interface ObligationDetail {
  periodStartDate: string;
  periodEndDate: string;
  dueDate: string;
  receivedDate?: string;
  status: string;
}

export interface BusinessObligationGroup {
  typeOfBusiness: string;
  businessId: string;
  obligationDetails: ObligationDetail[];
}

export interface IncomeExpenditureObligationsResponse {
  obligations: BusinessObligationGroup[];
}

/** HMRC Obligations (MTD) v3.0 — final declaration (crystallisation) */
export interface CrystallisationObligation {
  periodStartDate: string;
  periodEndDate: string;
  dueDate: string;
  status: string;
  receivedDate?: string;
}

export interface CrystallisationObligationsResponse {
  obligations: CrystallisationObligation[];
}

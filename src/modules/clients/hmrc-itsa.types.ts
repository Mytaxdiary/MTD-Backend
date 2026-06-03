/** HMRC Self Assessment Individual Details — Retrieve ITSA Status (v2.0). */
export interface ItsaStatusDetail {
  submittedOn?: string;
  status?: string;
  statusReason?: string;
  businessIncome2YearsPrior?: number;
}

export interface ItsaStatusYear {
  taxYear: string;
  itsaStatusDetails?: ItsaStatusDetail[];
}

export interface ItsaStatusResponse {
  itsaStatuses?: ItsaStatusYear[];
}

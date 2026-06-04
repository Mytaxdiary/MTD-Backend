/** HMRC Business Details (MTD) v2.0 — List All Businesses */
export interface BusinessListItem {
  typeOfBusiness: string;
  businessId: string;
  tradingName?: string;
}

export interface BusinessListResponse {
  listOfBusinesses: BusinessListItem[];
}

export interface BusinessAccountingPeriod {
  start?: string;
  end?: string;
}

export interface BusinessLatencyDetails {
  latencyEndDate?: string;
  taxYear1?: string;
  latencyIndicator1?: string;
  taxYear2?: string;
  latencyIndicator2?: string;
}

export interface BusinessQuarterlyTypeChoice {
  quarterlyPeriodType?: string;
  taxYearOfChoice?: string;
}

/** HMRC Business Details (MTD) v2.0 — Retrieve Business Details */
export interface BusinessDetailsResponse {
  businessId: string;
  typeOfBusiness: string;
  tradingName?: string;
  yearOfMigration?: string;
  firstAccountingPeriodStartDate?: string;
  firstAccountingPeriodEndDate?: string;
  latencyDetails?: BusinessLatencyDetails;
  accountingPeriods?: BusinessAccountingPeriod[];
  quarterlyTypeChoice?: BusinessQuarterlyTypeChoice;
  commencementDate?: string;
  cessationDate?: string;
  businessAddressLineOne?: string;
  businessAddressLineTwo?: string;
  businessAddressLineThree?: string;
  businessAddressLineFour?: string;
  businessAddressPostcode?: string;
  businessAddressCountryCode?: string;
}

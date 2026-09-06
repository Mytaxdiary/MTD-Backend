/** Browser-collected fields sent via X-Hmrc-Fraud-Context (base64 JSON). */
export interface FraudPreventionClientPayload {
  deviceId: string;
  userAgent: string;
  /** UTC offset label, e.g. UTC+05:00 */
  timezone: string;
  screens: FraudPreventionScreen[];
  windowWidth: number;
  windowHeight: number;
  /** Client public IP if known (optional — server may use X-Forwarded-For). */
  publicIp?: string;
  publicPort?: string;
  /** ISO timestamp when public IP was collected (client-side). */
  publicIpTimestamp?: string;
}

export interface FraudPreventionScreen {
  width: number;
  height: number;
  scalingFactor: number;
  colourDepth: number;
}

/** Merged context used when calling HMRC APIs. */
export interface HmrcFraudRequestContext {
  client: FraudPreventionClientPayload | null;
  userEmail: string;
  clientPublicIp?: string;
  clientPublicPort?: string;
  /** Unix timestamp (seconds) when the user's JWT was issued — used as Gov-Client-Multi-Factor timestamp. */
  loginAt?: number;
  /** True when the user completed a TOTP challenge in this session. */
  mfaAuthenticated?: boolean;
}

export interface FraudPreventionValidationResult {
  specVersion?: string;
  code?: string;
  message?: string;
  headers?: Array<{
    header: string;
    value?: string;
    code?: string;
    errors?: unknown[];
  }>;
  errors?: unknown[];
  warnings?: unknown[];
}

/** HMRC validation-feedback response (last request per endpoint of an API). */
export interface FraudPreventionFeedbackRequest {
  path?: string;
  method?: string;
  requestTimestamp?: string;
  code?: string;
  headers?: Array<{
    header: string;
    value?: string;
    code?: string;
    errors?: unknown[];
    warnings?: unknown[];
  }>;
  crossValidation?: unknown[];
}

export interface FraudPreventionFeedbackResult {
  requests?: FraudPreventionFeedbackRequest[];
  code?: string;
  message?: string;
}

/** API identifiers accepted by Test Fraud Prevention Headers validation-feedback. */
export const FRAUD_FEEDBACK_API_IDS = [
  'obligations-mtd',
  'business-details-mtd',
  'property-business-mtd',
  'self-employment-business-mtd',
  'self-assessment-accounts-mtd',
  'self-assessment-individual-details-mtd',
] as const;

export type FraudFeedbackApiId = (typeof FRAUD_FEEDBACK_API_IDS)[number];

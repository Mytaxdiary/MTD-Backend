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

/** One row from the uploaded CSV/Excel file, after header normalisation. */
export interface BulkImportRow {
  /** 1-based row number in the original file (header = 0, first data row = 1). */
  rowNumber: number;
  name?: string;
  nino?: string;
  postcode?: string;
  email?: string;
  phone?: string;
  agent_type?: string;
  personal_message?: string;
}

/** A single validation error pointing to a specific row + field. */
export interface BulkImportRowError {
  row: number;
  field: string;
  message: string;
}

/** Shape returned to the client when validation fails (HTTP 422). */
export interface BulkImportValidationFailure {
  valid: false;
  errors: BulkImportRowError[];
}

/** Shape returned when import succeeds. */
export interface BulkImportSuccess {
  valid: true;
  created: number;
  invitationsSent: number;
  warnings: Array<{ row: number; name: string; message: string }>;
}

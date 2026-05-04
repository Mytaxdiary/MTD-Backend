/** Shape returned by ResponseInterceptor for all successful responses */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/** Shape returned by AllExceptionsFilter for all error responses */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
}

/** Wrapper for paginated list endpoints */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Helper to construct a paginated response object */
export function toPaginatedData<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedData<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

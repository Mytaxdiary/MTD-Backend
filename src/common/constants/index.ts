export const API_VERSION = 'v1';
export const API_PREFIX = `api/${API_VERSION}`;

export const SWAGGER_TITLE = 'MTD ITSA API';
export const SWAGGER_DESCRIPTION =
  'Backend API for the MTD ITSA agent platform — manages clients, quarterly submissions, and HMRC obligations.';
export const SWAGGER_VERSION = '0.1.0';
export const SWAGGER_PATH = 'api/docs';

// Default pagination limits
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Bcrypt rounds — higher = slower but more secure
export const BCRYPT_ROUNDS = 12;

import { QueryFailedError } from 'typeorm';

/** MySQL duplicate key (unique/PK violation). */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driver = err.driverError as { errno?: number; code?: string } | undefined;
  return driver?.errno === 1062 || driver?.code === 'ER_DUP_ENTRY';
}

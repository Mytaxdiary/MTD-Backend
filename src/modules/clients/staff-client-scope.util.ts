import { FindOptionsWhere } from 'typeorm';
import { Client } from './entities/client.entity';

export type StaffClientScopeOptions = {
  /** Exclude portal-only customers from the result (client list, dashboard). */
  excludePortalOnly?: boolean;
};

/** Owner sees all clients. Staff see only clients assigned to them (unassigned are hidden). */
export function staffClientWhere(
  tenantId: string,
  actor?: { role?: string; userId?: string } | null,
  extra: FindOptionsWhere<Client> = {},
  options?: StaffClientScopeOptions,
): FindOptionsWhere<Client> {
  const where: FindOptionsWhere<Client> = { tenantId, ...extra };
  if (options?.excludePortalOnly) {
    where.portalOnly = false;
  }
  if (actor?.role === 'staff' && actor.userId) {
    where.assignedToUserId = actor.userId;
  }
  return where;
}

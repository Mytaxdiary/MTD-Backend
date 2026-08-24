import { FindOptionsWhere } from 'typeorm';
import { Client } from './entities/client.entity';

/** Owner sees all clients. Staff see only clients assigned to them (unassigned are hidden). */
export function staffClientWhere(
  tenantId: string,
  actor?: { role?: string; userId?: string } | null,
  extra: FindOptionsWhere<Client> = {},
): FindOptionsWhere<Client> {
  const where: FindOptionsWhere<Client> = { tenantId, ...extra };
  if (actor?.role === 'staff' && actor.userId) {
    where.assignedToUserId = actor.userId;
  }
  return where;
}

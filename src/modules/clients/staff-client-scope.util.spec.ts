import { staffClientWhere } from './staff-client-scope.util';

describe('staffClientWhere', () => {
  const tenantId = 'tenant-1';

  it('returns tenant-only filter for owners', () => {
    expect(staffClientWhere(tenantId, { role: 'owner', userId: 'u1' })).toEqual({ tenantId });
  });

  it('restricts staff to their assigned clients', () => {
    expect(staffClientWhere(tenantId, { role: 'staff', userId: 'staff-1' })).toEqual({
      tenantId,
      assignedToUserId: 'staff-1',
    });
  });

  it('does not filter when actor is omitted (cron / internal)', () => {
    expect(staffClientWhere(tenantId)).toEqual({ tenantId });
  });
});

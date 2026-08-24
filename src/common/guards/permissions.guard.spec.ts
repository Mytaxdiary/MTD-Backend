import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEFAULT_STAFF_PERMISSIONS, OWNER_PERMISSIONS } from '../../modules/users/permissions';
import { OWNER_ONLY_KEY, PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { PermissionsGuard } from './permissions.guard';

function run(
  user: Record<string, unknown> | undefined,
  meta: { ownerOnly?: boolean; permissions?: string[] },
): boolean {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === OWNER_ONLY_KEY) return meta.ownerOnly;
      if (key === PERMISSIONS_KEY) return meta.permissions;
      return undefined;
    },
  } as unknown as Reflector;
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return new PermissionsGuard(reflector).canActivate(ctx);
}

describe('PermissionsGuard', () => {
  const owner = {
    userId: 'o1',
    role: 'owner',
    permissions: OWNER_PERMISSIONS,
  };
  const staff = {
    userId: 's1',
    role: 'staff',
    permissions: { ...DEFAULT_STAFF_PERMISSIONS, canChase: true },
  };

  it('allows routes with no permission metadata', () => {
    expect(run(staff, {})).toBe(true);
  });

  it('lets the owner bypass permission checks', () => {
    expect(run(owner, { permissions: ['canAddClients'] })).toBe(true);
    expect(run(owner, { ownerOnly: true })).toBe(true);
  });

  it('allows staff who have the required permission', () => {
    expect(run(staff, { permissions: ['canChase'] })).toBe(true);
  });

  it('allows staff when they match any of several permissions', () => {
    expect(run(staff, { permissions: ['canManageTemplates', 'canChase'] })).toBe(true);
  });

  it('blocks staff who lack the required permission', () => {
    expect(() => run(staff, { permissions: ['canAddClients'] })).toThrow(ForbiddenException);
  });

  it('blocks staff on owner-only routes', () => {
    expect(() => run(staff, { ownerOnly: true })).toThrow(ForbiddenException);
  });

  it('blocks when a decorated route has no authenticated user', () => {
    expect(() => run(undefined, { permissions: ['canChase'] })).toThrow(ForbiddenException);
  });
});

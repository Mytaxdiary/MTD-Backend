import { SetMetadata } from '@nestjs/common';
import type { StaffPermissions } from '../../modules/users/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const OWNER_ONLY_KEY = 'ownerOnly';

export type PermissionKey = keyof StaffPermissions;

/** Staff must have at least one of these flags. Owner always passes. */
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Only the firm owner may call this route. */
export const RequireOwner = () => SetMetadata(OWNER_ONLY_KEY, true);

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from '../../modules/auth/strategies/jwt.strategy';
import { hasPermission } from '../../modules/users/permissions';
import {
  OWNER_ONLY_KEY,
  PERMISSIONS_KEY,
  type PermissionKey,
} from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ownerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!ownerOnly && (!required || required.length === 0)) {
      return true;
    }

    const actor = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!actor) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    if (ownerOnly && actor.role === 'staff') {
      throw new ForbiddenException('Only the firm owner can perform this action.');
    }

    if (required?.length && !required.some((key) => hasPermission(actor, key))) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    return true;
  }
}

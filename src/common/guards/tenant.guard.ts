import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * TenantGuard ensures the request has a valid tenantId from the JWT payload.
 * Apply after JwtAuthGuard on any route that accesses tenant-scoped data.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, TenantGuard)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { tenantId?: string } }>();

    if (!req.user?.tenantId) {
      throw new ForbiddenException('Tenant context is missing from the request');
    }

    return true;
  }
}

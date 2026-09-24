import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  AUTH_AUDIENCE_KEY,
  type AuthAudienceType,
} from '../../../common/decorators/auth-audience.decorator';
import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * JWT auth + audience check.
 * Default audience is `firm` (blocks platform admins).
 * Use `@AuthAudience('admin')` on admin routes; `@AuthAudience('any')` for logout.
 *
 * Reflector is constructed locally so modules can keep using `@UseGuards(JwtAuthGuard)`
 * without importing AuthModule (Nest would otherwise fail DI for constructor deps).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly reflector = new Reflector();

  handleRequest<TUser = RequestUser>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    const requiredAudience =
      this.reflector.getAllAndOverride<AuthAudienceType>(AUTH_AUDIENCE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'firm';

    if (requiredAudience === 'any') {
      return user;
    }

    const actor = user as unknown as RequestUser;

    if (requiredAudience === 'admin') {
      if (actor.role !== 'admin' || actor.audience !== 'admin') {
        throw new ForbiddenException('Platform admin access required.');
      }
      return user;
    }

    if (actor.role === 'admin' || actor.audience === 'admin') {
      throw new ForbiddenException('Use the admin panel to access this resource.');
    }

    return user;
  }
}

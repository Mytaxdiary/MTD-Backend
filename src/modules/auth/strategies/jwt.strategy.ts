import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { User } from '../../users/entities/user.entity';
import type { AppRole, AuthTokenAudience, StaffPermissions } from '../../users/permissions';
import {
  EMPTY_PERMISSIONS,
  audienceForRole,
  normalizePermissions,
  resolveAppRole,
} from '../../users/permissions';

export interface JwtPayload {
  /** Subject — userId (UUID) */
  sub: string;
  email: string;
  tenantId: string;
  /** True when the user completed a TOTP challenge in this session. */
  mfaAuthenticated?: boolean;
  role?: AppRole;
  audience?: AuthTokenAudience;
  permissions?: StaffPermissions;
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  userId: string;
  email: string;
  tenantId: string;
  /** Mirrors JWT iat — Unix timestamp (seconds) of when the token was issued. */
  loginAt?: number;
  /** True when TOTP was verified during this login. */
  mfaAuthenticated?: boolean;
  role: AppRole;
  audience: AuthTokenAudience;
  permissions: StaffPermissions;
}

/** Cookie name shared with the frontend tokenStorage constants. */
const ACCESS_COOKIE = 'mtd_at';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      // Try httpOnly cookie first, fall back to Authorization: Bearer header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies as Record<string, string>)?.[ACCESS_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret') ?? 'dev-fallback-secret',
      passReqToCallback: false,
    });
  }

  /** Validates token payload AND confirms user still exists in DB. */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['tenant'],
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer exists');
    }

    const role = resolveAppRole(user.role?.name);
    const audience = audienceForRole(role);

    // Firm users whose tenant was deactivated lose access immediately
    if (role !== 'admin' && user.tenantId && user.tenant && !user.tenant.isActive) {
      throw new UnauthorizedException(
        'This firm account has been deactivated. Please contact support.',
      );
    }
    if (role !== 'admin' && user.tenantId && !user.tenant) {
      // Tenant missing — treat as blocked
      throw new UnauthorizedException(
        'This firm account has been deactivated. Please contact support.',
      );
    }

    // Reject tokens issued for the wrong audience (e.g. role changed after issue)
    if (payload.audience && payload.audience !== audience) {
      throw new UnauthorizedException('Invalid token audience');
    }

    const permissions =
      role === 'admin' ? EMPTY_PERMISSIONS : normalizePermissions(user.permissions, role);

    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      loginAt: payload.iat,
      mfaAuthenticated: payload.mfaAuthenticated ?? false,
      role,
      audience,
      permissions,
    };
  }
}

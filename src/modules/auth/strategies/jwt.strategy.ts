import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { User } from '../../users/entities/user.entity';

export interface JwtPayload {
  /** Subject — userId (UUID) */
  sub: string;
  email: string;
  tenantId: string;
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  userId: string;
  email: string;
  tenantId: string;
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
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer exists');
    }
    return { userId: payload.sub, email: payload.email, tenantId: payload.tenantId };
  }
}

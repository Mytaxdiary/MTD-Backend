import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { ClientUser } from '../entities/client-user.entity';

export const PORTAL_JWT_STRATEGY = 'portal-jwt';
export const PORTAL_COOKIE = 'mtd_cp_at';

export interface PortalJwtPayload {
  sub: string;        // clientUserId, or 'preview' for agent preview sessions
  clientId: string;
  tenantId: string;
  role: 'client';
  /** True when an agent is previewing the portal — no real ClientUser record exists. */
  isPreview?: boolean;
}

export interface PortalRequestUser {
  clientUserId: string;
  clientId: string;
  tenantId: string;
  isPreview: boolean;
}

@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, PORTAL_JWT_STRATEGY) {
  constructor(
    configService: ConfigService,
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies as Record<string, string>)?.[PORTAL_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret') ?? 'dev-fallback-secret',
      passReqToCallback: false,
    });
  }

  async validate(payload: PortalJwtPayload): Promise<PortalRequestUser> {
    if (payload.role !== 'client') throw new UnauthorizedException();

    // Agent preview — no ClientUser lookup needed
    if (payload.isPreview) {
      return {
        clientUserId: 'preview',
        clientId: payload.clientId,
        tenantId: payload.tenantId,
        isPreview: true,
      };
    }

    const cu = await this.clientUserRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!cu) throw new UnauthorizedException('Portal account not found or inactive');
    return {
      clientUserId: payload.sub,
      clientId: payload.clientId,
      tenantId: payload.tenantId,
      isPreview: false,
    };
  }
}

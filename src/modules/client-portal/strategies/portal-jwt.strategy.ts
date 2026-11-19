import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { ClientUser } from '../entities/client-user.entity';
import { Client } from '../../clients/entities/client.entity';
import { requirePortalJwtSecret } from '../../../config/require-jwt-secret';

export const PORTAL_JWT_STRATEGY = 'portal-jwt';
export const PORTAL_COOKIE = 'mtd_cp_at';

export interface PortalJwtPayload {
  sub: string; // clientUserId, or 'preview' for agent preview sessions
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
  /** Used for Gov-Client-User-IDs on portal → HMRC calls. */
  email: string;
}

@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, PORTAL_JWT_STRATEGY) {
  constructor(
    configService: ConfigService,
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies as Record<string, string>)?.[PORTAL_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: requirePortalJwtSecret(configService),
      passReqToCallback: false,
    });
  }

  async validate(payload: PortalJwtPayload): Promise<PortalRequestUser> {
    if (payload.role !== 'client') throw new UnauthorizedException();

    // Agent preview — bind to a real client row for this firm (do not trust claims alone).
    if (payload.isPreview) {
      if (!payload.clientId || !payload.tenantId) {
        throw new UnauthorizedException('Invalid preview token');
      }
      const client = await this.clientRepo.findOne({
        where: { id: payload.clientId, tenantId: payload.tenantId },
      });
      if (!client) throw new UnauthorizedException('Preview client not found');
      return {
        clientUserId: 'preview',
        clientId: client.id,
        tenantId: client.tenantId,
        isPreview: true,
        email: `preview+${client.id}@mytaxdiary.local`,
      };
    }

    const cu = await this.clientUserRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!cu) throw new UnauthorizedException('Portal account not found or inactive');
    if (payload.clientId !== cu.clientId || payload.tenantId !== cu.tenantId) {
      throw new UnauthorizedException('Invalid portal token claims');
    }
    return {
      clientUserId: cu.id,
      clientId: cu.clientId,
      tenantId: cu.tenantId,
      isPreview: false,
      email: cu.email,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  /** Subject — userId (UUID) */
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  userId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret') ?? 'dev-fallback-secret',
    });
  }

  /** The returned object is attached to req.user by Passport. */
  validate(payload: JwtPayload): RequestUser {
    return { userId: payload.sub, email: payload.email };
  }
}

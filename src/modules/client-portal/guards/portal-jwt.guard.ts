import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PORTAL_JWT_STRATEGY } from '../strategies/portal-jwt.strategy';

@Injectable()
export class PortalJwtGuard extends AuthGuard(PORTAL_JWT_STRATEGY) {}

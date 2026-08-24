import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { ClientsService } from './clients.service';

/**
 * Staff may only load a client that is assigned to them.
 * Owner requests are unchanged. Cron / internal calls do not go through this interceptor.
 */
@Injectable()
export class StaffAssignedClientInterceptor implements NestInterceptor {
  constructor(private readonly clientsService: ClientsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const id = req.params?.id;
    const user = req.user as RequestUser | undefined;
    if (typeof id === 'string' && user?.role === 'staff') {
      await this.clientsService.findOne(user.tenantId, id, user);
    }
    return next.handle();
  }
}

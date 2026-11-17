import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorLogsService } from '../../modules/error-logs/error-logs.service';

type RequestWithUser = Request & {
  user?: {
    userId?: string;
    tenantId?: string;
    clientId?: string;
    email?: string;
  };
};

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly errorLogsService: ErrorLogsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithUser>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let logMessage = 'Internal server error';

    if (isHttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        logMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string | string[]) || exception.message;
        logMessage = Array.isArray(message) ? message.join('; ') : String(message);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      logMessage = exception.message || logMessage;
    }

    void this.persistErrorLog(request, statusCode, logMessage, isHttpException);

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Persist 5xx and unexpected failures. Skip routine 4xx (validation / auth noise).
   */
  private async persistErrorLog(
    request: RequestWithUser,
    statusCode: number,
    message: string,
    isHttpException: boolean,
  ): Promise<void> {
    const shouldLog = !isHttpException || statusCode >= 500;
    if (!shouldLog) return;

    const user = request.user;

    await this.errorLogsService.record({
      source: isHttpException ? 'api' : 'server',
      endpoint: this.safePath(request),
      httpMethod: request.method,
      statusCode,
      message,
      tenantId: user?.tenantId ?? null,
      clientId: user?.clientId ?? null,
      userId: user?.userId ?? null,
      metadata: {
        path: request.url,
      },
    });
  }

  private safePath(request: Request): string {
    try {
      const raw = request.originalUrl || request.url || '/';
      const pathOnly = raw.split('?')[0] || '/';
      return pathOnly.slice(0, 500);
    } catch {
      return '/';
    }
  }
}

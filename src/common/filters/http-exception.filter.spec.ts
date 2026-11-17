import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import type { ErrorLogsService } from '../../modules/error-logs/error-logs.service';

describe('AllExceptionsFilter — error log wiring', () => {
  const record = jest.fn().mockResolvedValue(undefined);
  const errorLogs = { record } as unknown as ErrorLogsService;
  const filter = new AllExceptionsFilter(errorLogs);

  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  function host(req: Record<string, unknown> = {}): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'GET',
          url: '/api/v1/clients?x=1',
          originalUrl: '/api/v1/clients?x=1',
          user: { userId: 'u1', tenantId: 't1' },
          ...req,
        }),
      }),
    } as unknown as ArgumentsHost;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not log routine 4xx', async () => {
    filter.catch(new BadRequestException('bad input'), host());
    await new Promise((r) => setImmediate(r));
    expect(record).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('logs unexpected errors as server source', async () => {
    filter.catch(new Error('boom'), host());
    await new Promise((r) => setImmediate(r));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'server',
        statusCode: 500,
        message: 'boom',
        endpoint: '/api/v1/clients',
        tenantId: 't1',
        userId: 'u1',
      }),
    );
  });
});

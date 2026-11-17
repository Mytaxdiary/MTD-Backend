import { ErrorLogsService } from './error-logs.service';

describe('ErrorLogsService', () => {
  const save = jest.fn(async (row) => ({ id: 'err-1', ...row, createdAt: new Date() }));
  const create = jest.fn((row) => row);
  const qb = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([
      [
        {
          id: 'err-1',
          source: 'hmrc',
          endpoint: '/obligations',
          httpMethod: 'GET',
          statusCode: 500,
          message: 'HMRC timeout',
          clientId: 'c1',
          clientLabel: 'Jane Client',
          tenantId: 't1',
          tenantLabel: 'Acme Tax',
          userId: null,
          metadata: null,
          createdAt: new Date('2026-11-15T10:00:00.000Z'),
        },
      ],
      1,
    ]),
  };
  const createQueryBuilder = jest.fn(() => qb);

  const repo = { save, create, createQueryBuilder };

  let service: ErrorLogsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ErrorLogsService(repo as never);
  });

  it('records an error without throwing', async () => {
    await service.record({
      source: 'hmrc',
      endpoint: '/individuals/obligations',
      message: 'Upstream 503',
      statusCode: 503,
      clientId: 'c1',
      tenantId: 't1',
    });
    expect(create).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });

  it('swallows persistence failures', async () => {
    save.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.record({ source: 'api', endpoint: '/clients', message: 'boom' }),
    ).resolves.toBeUndefined();
  });

  it('lists errors for admin with pagination', async () => {
    const result = await service.listForAdmin({ page: 1, limit: 20, source: 'hmrc' });
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0].endpoint).toBe('/obligations');
    expect(result.items[0].createdAt).toBe('2026-11-15T10:00:00.000Z');
    expect(qb.andWhere).toHaveBeenCalled();
  });
});

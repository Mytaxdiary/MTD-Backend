import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChaseLogsService, chasePeriodRowKey, chaseRowKey } from './chase-logs.service';
import { ChaseLog } from './entities/chase-log.entity';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { MailService } from '../mail/mail.service';

describe('ChaseLogsService — business/period-scoped chase', () => {
  const tenantId = 'tenant-1';
  const clientId = 'client-1';

  const mockRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 'log-1', ...x })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockClientRepo = { findOne: jest.fn() };
  const mockTenantRepo = { findOne: jest.fn() };
  const mockMailService = { sendChaseEmail: jest.fn() };

  let service: ChaseLogsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChaseLogsService,
        { provide: getRepositoryToken(ChaseLog), useValue: mockRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();
    service = module.get(ChaseLogsService);
  });

  it('chaseRowKey scopes by businessId', () => {
    expect(chaseRowKey(clientId, 'biz-a')).toBe('client-1::biz-a');
    expect(chasePeriodRowKey(clientId, 'biz-a', '2025-04-06')).toBe('client-1::biz-a::2025-04-06');
  });

  it('create persists business + period fields', async () => {
    const saved = await service.create(tenantId, {
      clientId,
      businessId: 'biz-a',
      businessName: 'Cafe A',
      periodStartDate: '2025-04-06',
      periodEndDate: '2025-07-05',
      dueDate: '2025-08-07',
      quarterLabel: 'Q1 2025–26',
      channel: 'email',
      subject: 'Hi',
      body: 'Please file',
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId,
        businessId: 'biz-a',
        businessName: 'Cafe A',
        periodStartDate: '2025-04-06',
        quarterLabel: 'Q1 2025–26',
        tenantId,
        status: 'sent',
      }),
    );
    expect(saved.periodStartDate).toBe('2025-04-06');
  });

  it('summaryForPeriods: chasing Q1 leaves Q2 unchanged', async () => {
    const now = new Date('2026-08-01T12:00:00Z');
    mockRepo.find.mockResolvedValue([
      {
        clientId,
        businessId: 'biz-a',
        periodStartDate: '2025-04-06',
        sentAt: now,
        status: 'sent',
      },
    ]);

    const map = await service.summaryForPeriods(tenantId, [
      { clientId, businessId: 'biz-a', periodStartDate: '2025-04-06' },
      { clientId, businessId: 'biz-a', periodStartDate: '2025-07-06' },
    ]);

    const q1 = map.get(chasePeriodRowKey(clientId, 'biz-a', '2025-04-06'));
    const q2 = map.get(chasePeriodRowKey(clientId, 'biz-a', '2025-07-06'));

    expect(q1?.chaseCount).toBe(1);
    expect(q2?.chaseCount).toBe(0);
    expect(q2?.lastChaseAt).toBeNull();
  });
});

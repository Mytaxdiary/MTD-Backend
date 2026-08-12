import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChaseLogsService, chaseRowKey } from './chase-logs.service';
import { ChaseLog } from './entities/chase-log.entity';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { MailService } from '../mail/mail.service';

describe('ChaseLogsService — business-scoped chase', () => {
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
    expect(chaseRowKey(clientId, 'biz-b')).toBe('client-1::biz-b');
    expect(chaseRowKey(clientId, null)).toBe('client-1::');
  });

  it('create persists businessId/businessName and does not flip client pipeline', async () => {
    const saved = await service.create(tenantId, {
      clientId,
      businessId: 'biz-a',
      businessName: 'Cafe A',
      channel: 'email',
      subject: 'Hi',
      body: 'Please file',
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId,
        businessId: 'biz-a',
        businessName: 'Cafe A',
        tenantId,
        status: 'sent',
      }),
    );
    expect(saved.businessId).toBe('biz-a');
    expect(saved.businessName).toBe('Cafe A');
  });

  it('summaryForBusinesses: chasing biz A leaves biz B/C unchanged', async () => {
    const now = new Date('2026-08-01T12:00:00Z');
    mockRepo.find.mockResolvedValue([
      {
        clientId,
        businessId: 'biz-a',
        sentAt: now,
        status: 'sent',
      },
    ]);

    const map = await service.summaryForBusinesses(tenantId, [
      { clientId, businessId: 'biz-a' },
      { clientId, businessId: 'biz-b' },
      { clientId, businessId: 'biz-c' },
    ]);

    const a = map.get(chaseRowKey(clientId, 'biz-a'));
    const b = map.get(chaseRowKey(clientId, 'biz-b'));
    const c = map.get(chaseRowKey(clientId, 'biz-c'));

    expect(a?.chaseCount).toBe(1);
    expect(a?.lastStatus).toBe('sent');
    expect(b?.chaseCount).toBe(0);
    expect(b?.lastChaseAt).toBeNull();
    expect(c?.chaseCount).toBe(0);
    expect(c?.lastChaseAt).toBeNull();
  });
});

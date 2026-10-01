import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { AdminService } from './admin.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Enquiry } from '../enquiries/entities/enquiry.entity';
import { Client } from '../clients/entities/client.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

describe('AdminService — firm lifecycle, force logout, enquiry follow-up', () => {
  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const actor = { userId: 'admin-1', email: 'admin@mytaxdiary.co.uk' };

  const mockTenantRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (t) => t),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEnquiryRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (e) => e),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockClientRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  const mockHmrcRepo = {
    findOne: jest.fn().mockResolvedValue(null),
  };

  const refreshQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockRefreshTokenRepo = {
    createQueryBuilder: jest.fn(() => refreshQb),
  };

  const mockAuditLogRepo = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => ({ id: 'audit-1', ...row })),
    createQueryBuilder: jest.fn(),
  };

  let service: AdminService;

  function activeTenant(overrides: Partial<Tenant> = {}): Tenant {
    return {
      id: tenantId,
      firmName: 'Harris Ltd',
      isActive: true,
      contactName: 'James Parker',
      contactEmail: 'james@harris.co.uk',
      deactivationReason: null,
      deactivatedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    } as Tenant;
  }

  function stubGetFirm(): void {
    jest.spyOn(service, 'getFirm').mockResolvedValue({
      id: tenantId,
      firmName: 'Harris Ltd',
      ownerEmail: 'james@harris.co.uk',
      contactName: 'James Parker',
      contactEmail: 'james@harris.co.uk',
      phone: null,
      address: null,
      postcode: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
      plan: null,
      status: 'active',
      deactivationReason: null,
      deactivatedAt: null,
      userCount: 1,
      clientCount: 0,
      lastLoginAt: null,
      hmrcConnected: false,
      hmrcStatus: null,
      hmrcConnectedAt: null,
      users: [],
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    refreshQb.update.mockReturnThis();
    refreshQb.set.mockReturnThis();
    refreshQb.where.mockReturnThis();
    refreshQb.andWhere.mockReturnThis();
    refreshQb.execute.mockResolvedValue({ affected: 1 });
    mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(refreshQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Enquiry), useValue: mockEnquiryRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(HmrcConnection), useValue: mockHmrcRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
        { provide: getRepositoryToken(AdminAuditLog), useValue: mockAuditLogRepo },
      ],
    }).compile();

    service = module.get(AdminService);
    stubGetFirm();
  });

  describe('setFirmActive', () => {
    it('deactivates firm, stores reason, and invalidates all sessions', async () => {
      const tenant = activeTenant();
      mockTenantRepo.findOne.mockResolvedValue(tenant);
      mockUserRepo.find.mockResolvedValue([{ id: userId }, { id: 'user-2' }]);

      await service.setFirmActive(tenantId, false, 'Suspected compromise', actor);

      expect(tenant.isActive).toBe(false);
      expect(tenant.deactivationReason).toBe('Suspected compromise');
      expect(tenant.deactivatedAt).toBeInstanceOf(Date);
      expect(mockTenantRepo.save).toHaveBeenCalledWith(tenant);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { id: In([userId, 'user-2']) },
        expect.objectContaining({ sessionInvalidatedAt: expect.any(Date) }),
      );
      expect(refreshQb.set).toHaveBeenCalledWith({ isRevoked: true });
      expect(refreshQb.execute).toHaveBeenCalled();
    });

    it('reactivates firm and clears deactivation fields without forcing logout', async () => {
      const tenant = activeTenant({
        isActive: false,
        deactivationReason: 'Billing',
        deactivatedAt: new Date('2026-02-01T00:00:00Z'),
      });
      mockTenantRepo.findOne.mockResolvedValue(tenant);

      await service.setFirmActive(tenantId, true, undefined, actor);

      expect(tenant.isActive).toBe(true);
      expect(tenant.deactivationReason).toBeNull();
      expect(tenant.deactivatedAt).toBeNull();
      expect(mockTenantRepo.save).toHaveBeenCalledWith(tenant);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(refreshQb.execute).not.toHaveBeenCalled();
    });

    it('updates reason when firm is already inactive (idempotent)', async () => {
      const tenant = activeTenant({
        isActive: false,
        deactivationReason: 'Old reason',
        deactivatedAt: new Date('2026-02-01T00:00:00Z'),
      });
      mockTenantRepo.findOne.mockResolvedValue(tenant);

      await service.setFirmActive(tenantId, false, 'Updated reason', actor);

      expect(tenant.deactivationReason).toBe('Updated reason');
      expect(mockTenantRepo.save).toHaveBeenCalledWith(tenant);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('rejects empty reason string when provided on deactivate', async () => {
      mockTenantRepo.findOne.mockResolvedValue(activeTenant());
      await expect(service.setFirmActive(tenantId, false, '   ', actor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when firm is missing', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);
      await expect(service.setFirmActive(tenantId, false, undefined, actor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('invalidateFirmSessions / invalidateUserSessions', () => {
    it('force-logs out all firm users without deactivating the firm', async () => {
      const tenant = activeTenant();
      mockTenantRepo.findOne.mockResolvedValue(tenant);
      mockUserRepo.find.mockResolvedValue([{ id: userId }, { id: 'user-2' }]);

      await service.invalidateFirmSessions(tenantId, actor);

      expect(tenant.isActive).toBe(true);
      expect(mockTenantRepo.save).not.toHaveBeenCalled();
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { id: In([userId, 'user-2']) },
        expect.objectContaining({ sessionInvalidatedAt: expect.any(Date) }),
      );
      expect(refreshQb.execute).toHaveBeenCalled();
      expect(service.getFirm).toHaveBeenCalledWith(tenantId);
    });

    it('force-logs out a single user on the firm', async () => {
      mockTenantRepo.findOne.mockResolvedValue(activeTenant());
      mockUserRepo.findOne.mockResolvedValue({
        id: userId,
        email: 'james@harris.co.uk',
        firstName: 'James',
        lastName: 'Parker',
      });

      await service.invalidateUserSessions(tenantId, userId, actor);

      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { id: In([userId]) },
        expect.objectContaining({ sessionInvalidatedAt: expect.any(Date) }),
      );
      expect(refreshQb.execute).toHaveBeenCalled();
    });

    it('rejects force-logout when user is not on the firm', async () => {
      mockTenantRepo.findOne.mockResolvedValue(activeTenant());
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.invalidateUserSessions(tenantId, 'other-user', actor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('does nothing when firm has no users', async () => {
      mockTenantRepo.findOne.mockResolvedValue(activeTenant());
      mockUserRepo.find.mockResolvedValue([]);

      await service.invalidateFirmSessions(tenantId, actor);

      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(refreshQb.execute).not.toHaveBeenCalled();
    });
  });

  describe('updateEnquiry (follow-up)', () => {
    function makeEnquiry(overrides: Partial<Enquiry> = {}): Enquiry {
      return {
        id: 'enq-1',
        name: 'Alex Smith',
        firm: 'Smith & Co',
        email: 'alex@smith.co.uk',
        phone: null,
        message: 'Interested in Growth',
        sourcePage: '/site/contact',
        planInterest: 'growth',
        status: 'new',
        internalNote: null,
        createdAt: new Date('2026-03-01T10:00:00Z'),
        updatedAt: new Date('2026-03-01T10:00:00Z'),
        ...overrides,
      } as Enquiry;
    }

    it('marks enquiry as contacted (convert to follow-up)', async () => {
      const enquiry = makeEnquiry();
      mockEnquiryRepo.findOne.mockResolvedValue(enquiry);

      const result = await service.updateEnquiry('enq-1', { status: 'contacted' }, actor);

      expect(enquiry.status).toBe('contacted');
      expect(mockEnquiryRepo.save).toHaveBeenCalledWith(enquiry);
      expect(result.status).toBe('contacted');
      expect(result.email).toBe('alex@smith.co.uk');
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });

    it('trims internal notes and stores null for blank note', async () => {
      const enquiry = makeEnquiry({ status: 'contacted', internalNote: 'old' });
      mockEnquiryRepo.findOne.mockResolvedValue(enquiry);

      const result = await service.updateEnquiry(
        'enq-1',
        { internalNote: '  Called back  ' },
        actor,
      );
      expect(result.internalNote).toBe('Called back');

      await service.updateEnquiry('enq-1', { internalNote: '   ' }, actor);
      expect(enquiry.internalNote).toBeNull();
    });

    it('rejects empty patch', async () => {
      mockEnquiryRepo.findOne.mockResolvedValue(makeEnquiry());
      await expect(service.updateEnquiry('enq-1', {}, actor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when enquiry is missing', async () => {
      mockEnquiryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateEnquiry('missing', { status: 'contacted' }, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

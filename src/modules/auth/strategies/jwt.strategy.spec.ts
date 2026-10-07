import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { JwtStrategy, type JwtPayload } from './jwt.strategy';

describe('JwtStrategy — session and firm access product rules', () => {
  const mockUserRepo = {
    findOne: jest.fn(),
  };

  let strategy: JwtStrategy;

  function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
    return {
      sub: 'user-1',
      email: 'james@harris.co.uk',
      tenantId: 'tenant-1',
      audience: 'firm',
      role: 'owner',
      iat: Math.floor(Date.now() / 1000) - 60,
      ...overrides,
    };
  }

  function firmUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'james@harris.co.uk',
      isActive: true,
      tenantId: 'tenant-1',
      sessionInvalidatedAt: null as Date | null,
      permissions: null,
      role: { name: 'owner' },
      tenant: { id: 'tenant-1', isActive: true },
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-jwt-secret') },
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('rejects access tokens issued before sessionInvalidatedAt (force logout)', async () => {
    const invalidatedAt = new Date();
    const oldIat = Math.floor(invalidatedAt.getTime() / 1000) - 120;
    mockUserRepo.findOne.mockResolvedValue(firmUser({ sessionInvalidatedAt: invalidatedAt }));

    await expect(strategy.validate(payload({ iat: oldIat }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strategy.validate(payload({ iat: oldIat }))).rejects.toThrow(
      /Session has been revoked/,
    );
  });

  it('allows tokens issued at or after sessionInvalidatedAt (re-login)', async () => {
    const invalidatedAt = new Date(Date.now() - 60_000);
    const freshIat = Math.floor(Date.now() / 1000);
    mockUserRepo.findOne.mockResolvedValue(firmUser({ sessionInvalidatedAt: invalidatedAt }));

    const result = await strategy.validate(payload({ iat: freshIat }));
    expect(result.userId).toBe('user-1');
    expect(result.role).toBe('owner');
    expect(result.audience).toBe('firm');
  });

  it('rejects firm users when the tenant is deactivated', async () => {
    mockUserRepo.findOne.mockResolvedValue(
      firmUser({ tenant: { id: 'tenant-1', isActive: false } }),
    );

    await expect(strategy.validate(payload())).rejects.toThrow(/deactivated/);
  });

  it('rejects firm users when the trial has ended', async () => {
    mockUserRepo.findOne.mockResolvedValue(
      firmUser({
        tenant: {
          id: 'tenant-1',
          isActive: true,
          billingStatus: 'trial',
          trialEndsAt: new Date('2020-01-01T00:00:00.000Z'),
        },
      }),
    );

    await expect(strategy.validate(payload())).rejects.toThrow(/TRIAL_EXPIRED/);
  });

  it('allows firm users still inside an active trial', async () => {
    mockUserRepo.findOne.mockResolvedValue(
      firmUser({
        tenant: {
          id: 'tenant-1',
          isActive: true,
          billingStatus: 'trial',
          trialEndsAt: new Date(Date.now() + 86_400_000),
        },
      }),
    );

    const result = await strategy.validate(payload());
    expect(result.userId).toBe('user-1');
  });

  it('still allows platform admins when no firm tenant applies', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@mytaxdiary.co.uk',
      isActive: true,
      tenantId: null,
      sessionInvalidatedAt: null,
      permissions: null,
      role: { name: 'admin' },
      tenant: null,
    });

    const result = await strategy.validate(
      payload({
        sub: 'admin-1',
        email: 'admin@mytaxdiary.co.uk',
        tenantId: '',
        audience: 'admin',
        role: 'admin',
      }),
    );
    expect(result.role).toBe('admin');
    expect(result.audience).toBe('admin');
  });

  it('rejects inactive users', async () => {
    mockUserRepo.findOne.mockResolvedValue(firmUser({ isActive: false }));
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

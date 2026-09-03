import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PortalService } from './portal.service';
import { ClientUser } from './entities/client-user.entity';
import { PortalMessage } from './entities/portal-message.entity';
import { PortalFile } from './entities/portal-file.entity';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { HmrcService } from '../hmrc/hmrc.service';
import { HmrcApiClient } from '../hmrc/hmrc-api.client';
import { MailService } from '../mail/mail.service';
import { AppNotificationsService } from '../app-notifications/app-notifications.service';
import * as crypto from 'crypto';
import * as cryptoHelper from '../../common/helpers/crypto.helper';

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_HASH_SECRET = 'test-secret';
const RAW_EMAIL = 'carol@example.com';

function makeClientUser(overrides: Partial<ClientUser> = {}): ClientUser {
  return {
    id: 'cu-1',
    clientId: 'client-1',
    tenantId: 'tenant-1',
    email: RAW_EMAIL,
    emailHash: crypto.createHmac('sha256', EMAIL_HASH_SECRET).update(RAW_EMAIL).digest('hex'),
    passwordHash: 'hashed-password',
    isActive: true,
    lastLoginAt: null,
    portalSetupToken: undefined,
    portalSetupTokenExpiresAt: undefined,
    ...overrides,
  } as unknown as ClientUser;
}

function makeClient() {
  return { id: 'client-1', name: 'Carol Upton', tenantId: 'tenant-1' } as Client;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockClientUserRepo = {
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  create: jest.fn(),
};

const mockClientRepo = {
  findOne: jest.fn(),
};

const mockTenantRepo = {
  findOne: jest.fn(),
};

const mockPortalMsgRepo = {
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockPortalFileRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('portal-access-token'),
  verify: jest.fn(),
  decode: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const cfg: Record<string, string> = {
      'app.frontendUrl': 'http://localhost:3000',
      'auth.jwtSecret': EMAIL_HASH_SECRET,
      EMAIL_HASH_SECRET,
    };
    return cfg[key];
  }),
};

const mockHmrcService = { getValidAccessToken: jest.fn() };
const mockHmrcApiClient = { fetch: jest.fn() };
const mockMailService = {
  sendPortalInvite: jest.fn().mockResolvedValue(undefined),
  sendPortalMessage: jest.fn().mockResolvedValue(undefined),
  sendPortalFileUploaded: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PortalService — login()', () => {
  let service: PortalService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalService,
        { provide: getRepositoryToken(ClientUser), useValue: mockClientUserRepo },
        { provide: getRepositoryToken(PortalMessage), useValue: mockPortalMsgRepo },
        { provide: getRepositoryToken(PortalFile), useValue: mockPortalFileRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HmrcService, useValue: mockHmrcService },
        { provide: HmrcApiClient, useValue: mockHmrcApiClient },
        { provide: MailService, useValue: mockMailService },
        {
          provide: AppNotificationsService,
          useValue: { create: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<PortalService>(PortalService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns accessToken and client name on valid credentials', async () => {
    const cu = makeClientUser();
    mockClientUserRepo.findOne.mockResolvedValue(cu);
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(true);
    mockClientRepo.findOne.mockResolvedValue(makeClient());

    const result = await service.login({ email: RAW_EMAIL, password: 'correct-password' });

    expect(result.accessToken).toBe('portal-access-token');
    expect(result.name).toBe('Carol Upton');
  });

  it('updates lastLoginAt on successful login', async () => {
    const cu = makeClientUser();
    mockClientUserRepo.findOne.mockResolvedValue(cu);
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(true);
    mockClientRepo.findOne.mockResolvedValue(makeClient());

    await service.login({ email: RAW_EMAIL, password: 'correct' });

    expect(mockClientUserRepo.save).toHaveBeenCalled();
    const savedCu = mockClientUserRepo.save.mock.calls[0][0] as ClientUser;
    expect(savedCu.lastLoginAt).toBeInstanceOf(Date);
  });

  it('returns empty string for name when client record is missing', async () => {
    mockClientUserRepo.findOne.mockResolvedValue(makeClientUser());
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(true);
    mockClientRepo.findOne.mockResolvedValue(null);

    const result = await service.login({ email: RAW_EMAIL, password: 'correct' });

    expect(result.name).toBe('');
  });

  // ── Email not found ─────────────────────────────────────────────────────────

  it('throws UnauthorizedException when email does not match any active user', async () => {
    mockClientUserRepo.findOne.mockResolvedValue(null);

    await expect(service.login({ email: 'nobody@example.com', password: 'any' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── Inactive account ────────────────────────────────────────────────────────

  it('throws UnauthorizedException when account is inactive (portal not set up)', async () => {
    // isActive: false means the client never completed portal setup
    mockClientUserRepo.findOne.mockResolvedValue(null); // findOne filters isActive: true

    await expect(service.login({ email: RAW_EMAIL, password: 'any' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── Wrong password ──────────────────────────────────────────────────────────

  it('throws UnauthorizedException on wrong password', async () => {
    mockClientUserRepo.findOne.mockResolvedValue(makeClientUser());
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(false);

    await expect(service.login({ email: RAW_EMAIL, password: 'wrong-password' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('uses the correct error message to prevent email enumeration', async () => {
    mockClientUserRepo.findOne.mockResolvedValue(null);

    let error: UnauthorizedException | undefined;
    try {
      await service.login({ email: 'nobody@example.com', password: 'any' });
    } catch (err) {
      error = err as UnauthorizedException;
    }

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error?.message).toBe('Invalid email or password');
  });

  // ── Account with no password hash ───────────────────────────────────────────

  it('throws UnauthorizedException when portal setup was not completed (no password hash)', async () => {
    const cu = makeClientUser({ passwordHash: undefined } as Partial<ClientUser>);
    mockClientUserRepo.findOne.mockResolvedValue(cu);

    await expect(service.login({ email: RAW_EMAIL, password: 'any' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

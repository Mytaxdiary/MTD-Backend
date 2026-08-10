import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import * as cryptoHelper from '../../common/helpers/crypto.helper';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<ReturnType<typeof baseUser>> = {}) {
  return { ...baseUser(), ...overrides };
}

function baseUser() {
  return {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    firmName: 'Test Firm',
    passwordHash: 'hashed-password',
    isActive: true,
    isEmailVerified: true,
    mfaEnabled: false,
    totpSecret: null as string | null,
    tenantId: 'tenant-1',
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  emailExists: jest.fn(),
  create: jest.fn(),
  updateLastLogin: jest.fn(),
  findOrCreateAgentRole: jest.fn(),
  markEmailVerified: jest.fn(),
  updatePassword: jest.fn(),
  setMfa: jest.fn(),
};

const mockTenantsService = {
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
  verify: jest.fn(),
  decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-1' }),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const cfg: Record<string, string> = {
      'auth.jwtExpiresIn': '1h',
      'auth.refreshTokenExpiresIn': '7d',
      'app.frontendUrl': 'http://localhost:3000',
    };
    return cfg[key];
  }),
};

const mockMailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

const mockRefreshTokenRepo = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  findOne: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockPasswordResetTokenRepo = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  findOne: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockEmailVerificationTokenRepo = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  findOne: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AuthService — login()', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: TenantsService, useValue: mockTenantsService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
        { provide: getRepositoryToken(PasswordResetToken), useValue: mockPasswordResetTokenRepo },
        {
          provide: getRepositoryToken(EmailVerificationToken),
          useValue: mockEmailVerificationTokenRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns tokens and user info on valid credentials', async () => {
    const user = makeUser();
    mockUsersService.findByEmail.mockResolvedValue(user);
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(true);

    const result = await service.login({ email: user.email, password: 'correct-password' });

    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe(user.email);
    expect(result.user.id).toBe(user.id);
    expect(result.requiresMfa).toBeFalsy();
    expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith(user.id);
  });

  it('normalises email to lowercase before lookup', async () => {
    const user = makeUser();
    mockUsersService.findByEmail.mockResolvedValue(user);
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(true);

    await service.login({ email: 'JOHN@EXAMPLE.COM', password: 'correct' });

    expect(mockUsersService.findByEmail).toHaveBeenCalledWith('john@example.com');
  });

  // ── Wrong / missing user ────────────────────────────────────────────────────

  it('throws UnauthorizedException when email does not exist', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    await expect(service.login({ email: 'nobody@example.com', password: 'any' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when account is inactive', async () => {
    mockUsersService.findByEmail.mockResolvedValue(makeUser({ isActive: false }));

    await expect(service.login({ email: 'john@example.com', password: 'any' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── Wrong password ──────────────────────────────────────────────────────────

  it('throws UnauthorizedException on wrong password', async () => {
    mockUsersService.findByEmail.mockResolvedValue(makeUser());
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(false);

    await expect(
      service.login({ email: 'john@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('does not expose whether the email exists in the error message', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    let error: UnauthorizedException | undefined;
    try {
      await service.login({ email: 'nobody@example.com', password: 'any' });
    } catch (err) {
      error = err as UnauthorizedException;
    }

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error?.message).toBe('Invalid credentials');
  });

  // ── MFA ─────────────────────────────────────────────────────────────────────

  it('returns requiresMfa:true and mfaToken when MFA is enabled', async () => {
    const user = makeUser({ mfaEnabled: true, totpSecret: 'some-secret' });
    mockUsersService.findByEmail.mockResolvedValue(user);
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(true);
    mockJwtService.sign.mockReturnValueOnce('mfa-challenge-token');

    const result = await service.login({ email: user.email, password: 'correct' });

    expect(result.requiresMfa).toBe(true);
    expect(result.mfaToken).toBe('mfa-challenge-token');
    expect(result.accessToken).toBe('');
    expect(result.refreshToken).toBe('');
  });

  // ── Email not verified ──────────────────────────────────────────────────────

  it('still logs in when email is not verified, but re-sends verification email', async () => {
    const user = makeUser({ isEmailVerified: false });
    mockUsersService.findByEmail.mockResolvedValue(user);
    jest.spyOn(cryptoHelper, 'comparePassword').mockResolvedValue(true);
    mockEmailVerificationTokenRepo.update.mockResolvedValue(undefined);
    mockEmailVerificationTokenRepo.save.mockResolvedValue({});

    const result = await service.login({ email: user.email, password: 'correct' });

    expect(result.accessToken).toBe('mock-access-token');
    expect(mockMailService.sendEmailVerificationEmail).toHaveBeenCalled();
  });
});

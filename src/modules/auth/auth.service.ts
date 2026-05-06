import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, comparePassword } from '../../common/helpers/crypto.helper';
import { User } from '../users/entities/user.entity';
import type { AuthResponse, TokensResponse } from './types/auth-response.type';
import type { JwtPayload } from './strategies/jwt.strategy';

const RESET_TOKEN_EXPIRY_HOURS = 1;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepo: Repository<PasswordResetToken>,
  ) {}

  // ── Register ────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const exists = await this.usersService.emailExists(dto.email.toLowerCase());
    if (exists) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const role = await this.usersService.findOrCreateAgentRole();

    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      firmName: dto.practiceName,
      email: dto.email.toLowerCase(),
      passwordHash,
      role,
    });

    const tokens = await this.issueTokens(user.id, user.email);

    // Fire-and-forget welcome email stub
    void this.mailService.sendWelcomeEmail(user.email, user.firstName);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        firmName: user.firmName,
      },
    };
  }

  // ── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());

    // Generic message — never reveal whether the email exists
    const invalidCredentials = new UnauthorizedException('Invalid credentials');
    if (!user || !user.isActive) throw invalidCredentials;

    const passwordMatch = await comparePassword(dto.password, user.passwordHash);
    if (!passwordMatch) throw invalidCredentials;

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user.id, user.email);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        firmName: user.firmName,
      },
    };
  }

  // ── Forgot password ──────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email.toLowerCase());

    // Always return silently — prevents user enumeration attacks
    if (!user || !user.isActive) return;

    // Invalidate any existing unused tokens for this user
    await this.passwordResetTokenRepo.update(
      { user: { id: user.id }, isUsed: false },
      { isUsed: true },
    );

    // Generate raw token, store only the hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS);

    const resetToken = this.passwordResetTokenRepo.create({
      user,
      tokenHash,
      expiresAt,
      isUsed: false,
    });
    await this.passwordResetTokenRepo.save(resetToken);

    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);
  }

  // ── Reset password ───────────────────────────────────────────────────────

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const resetToken = await this.passwordResetTokenRepo.findOne({
      where: { tokenHash, isUsed: false },
      relations: ['user'],
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link. Please request a new one.');
    }

    // Mark token as used before any other write (single-use)
    await this.passwordResetTokenRepo.update(resetToken.id, { isUsed: true });

    const passwordHash = await hashPassword(newPassword);
    await this.usersService.updatePassword(resetToken.user.id, passwordHash);

    // Revoke all refresh tokens — force re-login after password change
    await this.refreshTokenRepo.update(
      { user: { id: resetToken.user.id }, isRevoked: false },
      { isRevoked: true },
    );
  }

  // ── Get profile ──────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      firmName: user.firmName,
    };
  }

  // ── Refresh tokens ───────────────────────────────────────────────────────

  async refreshTokens(rawRefreshToken: string): Promise<TokensResponse> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, isRevoked: false },
      relations: ['user'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke used token immediately (rotation)
    await this.refreshTokenRepo.update(stored.id, { isRevoked: true });

    return this.issueTokens(stored.user.id, stored.user.email);
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  async logout(userId: string, rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await this.refreshTokenRepo.update({ tokenHash }, { isRevoked: true });
    } else {
      // Revoke all refresh tokens for the user if no specific token provided
      await this.refreshTokenRepo.update(
        { user: { id: userId }, isRevoked: false },
        { isRevoked: true },
      );
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async issueTokens(userId: string, email: string): Promise<TokensResponse> {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const refreshExpiresIn = this.configService.get<string>('auth.refreshTokenExpiresIn') ?? '7d';
    const expiresAt = this.parseExpiresIn(refreshExpiresIn);

    const refreshTokenEntity = this.refreshTokenRepo.create({
      user: { id: userId } as User,
      tokenHash,
      expiresAt,
      isRevoked: false,
    });
    await this.refreshTokenRepo.save(refreshTokenEntity);

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /** Parses duration strings like '7d', '1h', '30m' into a future Date. */
  private parseExpiresIn(expiresIn: string): Date {
    const date = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      date.setDate(date.getDate() + 7);
      return date;
    }
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        date.setSeconds(date.getSeconds() + value);
        break;
      case 'm':
        date.setMinutes(date.getMinutes() + value);
        break;
      case 'h':
        date.setHours(date.getHours() + value);
        break;
      case 'd':
        date.setDate(date.getDate() + value);
        break;
    }
    return date;
  }
}

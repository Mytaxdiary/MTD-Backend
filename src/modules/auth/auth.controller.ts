import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LogoutDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { RequestUser } from './strategies/jwt.strategy';

interface AuthRequest extends ExpressRequest {
  user: RequestUser;
}

const ACCESS_COOKIE = 'mtd_at';
const REFRESH_COOKIE = 'mtd_rt';
const ONE_DAY_MS = 86_400_000;
const SEVEN_DAYS_MS = 604_800_000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Register a new agent account' })
  @ApiCreatedResponse({ description: 'Account created — tokens set as httpOnly cookies' })
  @ApiConflictResponse({ description: 'Email address is already registered' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and receive tokens via httpOnly cookies' })
  @ApiOkResponse({ description: 'Tokens set as httpOnly cookies; user profile returned' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset email',
    description:
      'Always returns success regardless of whether the email is registered (prevents user enumeration).',
  })
  @ApiOkResponse({ description: 'Reset email sent if the address is registered' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If this email is registered, a reset link has been sent.' };
  }

  // ── Reset password ────────────────────────────────────────────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from the email link' })
  @ApiOkResponse({ description: 'Password updated successfully' })
  @ApiBadRequestResponse({ description: 'Token is invalid, expired, or already used' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password has been reset successfully.' };
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({ description: 'Returns user profile data' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getProfile(@Request() req: AuthRequest) {
    return this.authService.getProfile(req.user.userId);
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Silent token refresh — reads refresh token from httpOnly cookie',
  })
  @ApiOkResponse({ description: 'New tokens issued; cookies updated' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is missing, invalid, or expired' })
  async refresh(@Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!rawRefreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
    const result = await this.authService.refreshTokens(rawRefreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Log out — revokes refresh token and clears cookies' })
  @ApiOkResponse({ description: 'Logged out successfully' })
  async logout(
    @Request() req: AuthRequest,
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieRefreshToken = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    await this.authService.logout(req.user.userId, cookieRefreshToken ?? dto.refreshToken);
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully.' };
  }

  // ── Email verification ────────────────────────────────────────────────────

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address using token from the verification email' })
  @ApiQuery({ name: 'token', required: true, description: 'Email verification token' })
  @ApiOkResponse({ description: 'Email verified successfully' })
  @ApiBadRequestResponse({ description: 'Token is invalid, expired, or already used' })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully.' };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProd = this.configService.get<string>('app.env') === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
    res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: ONE_DAY_MS });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...base, maxAge: SEVEN_DAYS_MS });
  }

  private clearAuthCookies(res: Response): void {
    const opts = { httpOnly: true, path: '/' };
    res.clearCookie(ACCESS_COOKIE, opts);
    res.clearCookie(REFRESH_COOKIE, opts);
  }
}

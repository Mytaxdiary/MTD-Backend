import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { RequestUser } from './strategies/jwt.strategy';

interface AuthRequest extends Request {
  user: RequestUser;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new agent account' })
  @ApiCreatedResponse({ description: 'Account created — returns tokens and user profile' })
  @ApiConflictResponse({ description: 'Email address is already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and receive access + refresh tokens' })
  @ApiOkResponse({ description: 'Returns tokens and user profile' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

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

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from the email link' })
  @ApiOkResponse({ description: 'Password updated successfully' })
  @ApiBadRequestResponse({ description: 'Token is invalid, expired, or already used' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password has been reset successfully.' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({ description: 'Returns user profile data' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getProfile(@Request() req: AuthRequest) {
    return this.authService.getProfile(req.user.userId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a valid refresh token for new tokens' })
  @ApiOkResponse({ description: 'Returns new access + refresh tokens' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid or expired' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Log out — revokes the current refresh token',
    description: 'Pass refreshToken in body to revoke a specific token, or omit to revoke all.',
  })
  @ApiOkResponse({ description: 'Logged out successfully' })
  async logout(@Request() req: AuthRequest, @Body() dto: LogoutDto) {
    await this.authService.logout(req.user.userId, dto.refreshToken);
    return { message: 'Logged out successfully.' };
  }
}

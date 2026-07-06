import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PortalService } from './portal.service';
import { PortalSetupDto } from './dto/portal-setup.dto';
import { PortalLoginDto } from './dto/portal-login.dto';
import { PortalPreviewExchangeDto } from './dto/portal-preview-exchange.dto';

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours (seconds)

function setPortalCookie(res: Response, token: string, cookieName: string): void {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE * 1000,
    path: '/',
  });
}

@ApiTags('Client Portal — Auth')
@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalService: PortalService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Client sets password via one-time setup token' })
  async setup(@Body() dto: PortalSetupDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, name } = await this.portalService.setup(dto);
    setPortalCookie(res, accessToken, this.portalService.cookieName());
    return { name };
  }

  @Post('login')
  @ApiOperation({ summary: 'Client portal login' })
  async login(@Body() dto: PortalLoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, name } = await this.portalService.login(dto);
    setPortalCookie(res, accessToken, this.portalService.cookieName());
    return { name };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Client portal logout' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.portalService.cookieName(), { path: '/' });
    return { message: 'Logged out' };
  }

  /**
   * Agent preview — exchange a short-lived preview token for a portal session cookie.
   * Called by /portal/preview page immediately on load.
   */
  @Post('preview-session')
  @ApiOperation({ summary: 'Exchange preview token for a portal session (agent use only)' })
  previewSession(@Body() dto: PortalPreviewExchangeDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken } = this.portalService.exchangePreviewToken(dto.token);
    setPortalCookie(res, accessToken, this.portalService.cookieName());
    return { ok: true };
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Returns API uptime and database connectivity status.',
  })
  @ApiOkResponse({
    description: 'API is running. status="degraded" means DB is unreachable.',
    schema: {
      example: {
        status: 'ok',
        message: 'API is running',
        uptime: 42,
        timestamp: '2026-04-22T10:00:00.000Z',
        checks: {
          database: { status: 'ok', message: 'Connected', responseTimeMs: 3 },
        },
      },
    },
  })
  check() {
    return this.healthService.check();
  }

  /**
   * Debug endpoint — requires a valid JWT.
   * Shows mail config status and optionally sends a test email.
   * Use: GET /health/mail?to=you@example.com
   */
  @Get('mail')
  @ApiOperation({ summary: '[DEBUG] Check mail config and optionally send a test email' })
  @ApiQuery({ name: 'to', required: false, description: 'Send a test email to this address' })
  async checkMail(@Query('to') to: string | undefined) {
    const nodeEnv = this.configService.get<string>('app.env');
    const mailHost = this.configService.get<string>('mail.host');
    const mailUser = this.configService.get<string>('mail.user');
    const mailFrom = this.configService.get<string>('mail.from');
    const frontendUrl = this.configService.get<string>('app.frontendUrl');

    const config = {
      nodeEnv,
      isProd: nodeEnv === 'production',
      mailConfigured: !!mailHost,
      mailHost: mailHost ?? '(not set)',
      mailUser: mailUser ? `${mailUser.slice(0, 3)}***` : '(not set)',
      mailFrom: mailFrom ?? '(not set)',
      frontendUrl: frontendUrl ?? '(not set)',
    };

    let testEmailResult: string | null = null;

    if (to) {
      try {
        await this.mailService.sendWelcomeEmail(to, 'Debug Test');
        testEmailResult = `Test email sent to ${to}`;
      } catch (err: unknown) {
        testEmailResult = `Failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    return {
      config,
      testEmail: to ? testEmailResult : 'Pass ?to=email to send a test email',
    };
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

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
}

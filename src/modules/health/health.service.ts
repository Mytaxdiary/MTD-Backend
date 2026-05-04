import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface DbCheckResult {
  status: 'ok' | 'error';
  message: string;
  responseTimeMs?: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check() {
    const db = await this.checkDatabase();
    const overallStatus = db.status === 'ok' ? 'ok' : 'degraded';

    return {
      status: overallStatus,
      message: 'API is running',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: db,
      },
    };
  }

  private async checkDatabase(): Promise<DbCheckResult> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        message: 'Connected',
        responseTimeMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.warn('Database health check failed', error);
      return {
        status: 'error',
        message: 'Unable to connect to database',
        responseTimeMs: Date.now() - start,
      };
    }
  }
}

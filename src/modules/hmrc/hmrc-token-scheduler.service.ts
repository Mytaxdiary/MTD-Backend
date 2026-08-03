import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { HmrcConnection } from './entities/hmrc-connection.entity';
import { HmrcService } from './hmrc.service';

/**
 * How far ahead of access-token expiry we proactively refresh.
 * HMRC access tokens last ~4 hours; refreshing 1 hour early keeps Settings
 * showing Active without requiring a manual refresh or an inbound API call.
 */
const REFRESH_AHEAD_MS = 60 * 60 * 1000;

@Injectable()
export class HmrcTokenSchedulerService {
  private readonly logger = new Logger(HmrcTokenSchedulerService.name);

  constructor(
    @InjectRepository(HmrcConnection)
    private readonly connectionRepo: Repository<HmrcConnection>,
    private readonly hmrcService: HmrcService,
  ) {}

  /**
   * Runs every 30 minutes.
   * Finds connected tenants whose access token expires within the next hour
   * and refreshes them before they go stale.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async refreshExpiringTokens(): Promise<void> {
    const now = new Date();
    const refreshBefore = new Date(now.getTime() + REFRESH_AHEAD_MS);

    const expiring = await this.connectionRepo.find({
      where: {
        status: 'connected',
        accessTokenExpiresAt: LessThan(refreshBefore),
      },
    });

    // Skip connections whose refresh token has already expired
    const candidates = expiring.filter((c) => {
      if (!c.refreshTokenExpiresAt) return true;
      return c.refreshTokenExpiresAt.getTime() > now.getTime();
    });

    if (candidates.length === 0) {
      this.logger.debug('HMRC token scheduler — nothing to refresh');
      return;
    }

    this.logger.log(`HMRC token scheduler — refreshing ${candidates.length} connection(s)`);

    let refreshed = 0;
    let failed = 0;

    for (const connection of candidates) {
      try {
        await this.hmrcService.refreshHmrcTokens(connection.tenantId);
        refreshed++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `HMRC token refresh failed for tenant ${connection.tenantId}: ${String(err)}`,
        );
      }
    }

    this.logger.log(`HMRC token scheduler complete — refreshed: ${refreshed}, failed: ${failed}`);
  }
}

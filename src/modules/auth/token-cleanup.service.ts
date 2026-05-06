import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

/**
 * Runs scheduled cleanup jobs to remove stale token rows from the database.
 *
 * Schedules:
 *  - Refresh tokens:        daily at 02:00 — deletes expired or revoked rows older than 1 day
 *  - Password reset tokens: daily at 02:15 — deletes expired or used rows older than 1 day
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepo: Repository<PasswordResetToken>,
  ) {}

  /** Purge expired or revoked refresh tokens daily at 02:00. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeRefreshTokens(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1); // keep rows up to 1 day after expiry for audit

    const { affected } = await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .where('(expires_at < :cutoff OR is_revoked = 1)', { cutoff })
      .execute();

    this.logger.log(`[Cleanup] Deleted ${affected ?? 0} stale refresh token(s)`);
  }

  /** Purge expired or used password reset tokens daily at 02:15. */
  @Cron('15 2 * * *')
  async purgePasswordResetTokens(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);

    const { affected } = await this.passwordResetTokenRepo
      .createQueryBuilder()
      .delete()
      .where('(expires_at < :cutoff OR is_used = 1)', { cutoff })
      .execute();

    this.logger.log(`[Cleanup] Deleted ${affected ?? 0} stale password reset token(s)`);
  }

  /**
   * Manual trigger — useful for testing or one-off admin cleanup.
   * Not exposed via HTTP; call directly from a service or CLI command if needed.
   */
  async runNow(): Promise<{ refreshTokens: number; passwordResetTokens: number }> {
    const now = new Date();

    const rt = await this.refreshTokenRepo.delete([
      { isRevoked: true },
      { expiresAt: LessThan(now) },
    ]);

    const prt = await this.passwordResetTokenRepo.delete([
      { isUsed: true },
      { expiresAt: LessThan(now) },
    ]);

    return {
      refreshTokens: rt.affected ?? 0,
      passwordResetTokens: prt.affected ?? 0,
    };
  }
}

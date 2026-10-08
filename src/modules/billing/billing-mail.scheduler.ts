import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import {
  shouldSendTrialEndingEmail,
  shouldSendTrialExpiredEmail,
} from './billing-mail-window.util';

type OwnerRow = {
  tenantId: string;
  email: string;
  firstName: string;
};

/**
 * Daily billing emails for trials.
 * - Day −2: soft reminder (once)
 * - After trialEndsAt: expired notice + flip billingStatus to `expired` (once)
 *
 * Payment failed/succeeded are sent from Stripe webhooks via BillingService, not here.
 */
@Injectable()
export class BillingMailScheduler {
  private readonly logger = new Logger(BillingMailScheduler.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDailyTrialEmails(): Promise<void> {
    this.logger.log('Billing trial-email cron started');
    const now = new Date();

    const tenants = await this.tenantRepo.find({
      where: { billingStatus: 'trial' },
    });

    if (tenants.length === 0) {
      this.logger.log('No trial tenants — skipping billing mail cron');
      return;
    }

    const owners = await this.ownersForTenants(tenants.map((t) => t.id));
    let endingSent = 0;
    let expiredSent = 0;

    for (const tenant of tenants) {
      const owner = owners.get(tenant.id);
      if (!owner) {
        this.logger.warn(`No owner email for trial tenant ${tenant.id} — skip mail`);
        continue;
      }

      try {
        if (
          shouldSendTrialEndingEmail({
            billingStatus: tenant.billingStatus,
            trialEndsAt: tenant.trialEndsAt,
            alreadySent: !!tenant.trialEndingEmailSentAt,
            now,
          })
        ) {
          await this.mailService.sendTrialEndingEmail(owner.email, {
            firstName: owner.firstName,
            firmName: tenant.firmName,
            trialEndsAt: tenant.trialEndsAt!,
          });
          tenant.trialEndingEmailSentAt = now;
          await this.tenantRepo.save(tenant);
          endingSent += 1;
        }

        if (
          shouldSendTrialExpiredEmail({
            billingStatus: tenant.billingStatus,
            trialEndsAt: tenant.trialEndsAt,
            alreadySent: !!tenant.trialExpiredEmailSentAt,
            now,
          })
        ) {
          await this.mailService.sendTrialExpiredEmail(owner.email, {
            firstName: owner.firstName,
            firmName: tenant.firmName,
          });
          tenant.billingStatus = 'expired';
          tenant.trialExpiredEmailSentAt = now;
          await this.tenantRepo.save(tenant);
          expiredSent += 1;
        }
      } catch (err) {
        this.logger.error(`Billing mail failed for tenant ${tenant.id}`, err);
      }
    }

    this.logger.log(`Billing trial-email cron done — ending=${endingSent}, expired=${expiredSent}`);
  }

  private async ownersForTenants(tenantIds: string[]): Promise<Map<string, OwnerRow>> {
    const map = new Map<string, OwnerRow>();
    if (tenantIds.length === 0) return map;

    const rows = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.role', 'r')
      .select('u.tenant_id', 'tenantId')
      .addSelect('u.email', 'email')
      .addSelect('u.first_name', 'firstName')
      .where('u.tenant_id IN (:...tenantIds)', { tenantIds })
      .andWhere('r.name = :owner', { owner: 'owner' })
      .andWhere('u.is_active = true')
      .orderBy('u.createdAt', 'ASC')
      .getRawMany<OwnerRow>();

    for (const row of rows) {
      if (!map.has(row.tenantId)) {
        map.set(row.tenantId, row);
      }
    }
    return map;
  }
}

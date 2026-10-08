import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/entities/user.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { TrialEmailDomain } from './entities/trial-email-domain.entity';
import {
  BILLING_ERROR,
  BILLING_INCLUDED_CLIENTS,
  DEFAULT_TRIAL_DAYS,
  PLATFORM_SETTING_TRIAL_DAYS,
} from './billing.constants';
import { emailDomain, isCorporateTrialDomain } from './email-domain.util';
import { evaluateBillingAccess } from './billing-access.util';
import { calcMonthlyFee, type MonthlyFeeQuote } from './pricing.util';
import { MailService } from '../mail/mail.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(PlatformSetting)
    private readonly settingRepo: Repository<PlatformSetting>,
    @InjectRepository(TrialEmailDomain)
    private readonly trialDomainRepo: Repository<TrialEmailDomain>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async getTrialDays(): Promise<number> {
    const row = await this.settingRepo.findOne({
      where: { key: PLATFORM_SETTING_TRIAL_DAYS },
    });
    if (!row) return DEFAULT_TRIAL_DAYS;
    const n = parseInt(row.value, 10);
    if (!Number.isFinite(n) || n < 1 || n > 365) return DEFAULT_TRIAL_DAYS;
    return n;
  }

  async setTrialDays(days: number): Promise<number> {
    const value = String(Math.min(365, Math.max(1, Math.floor(days))));
    let row = await this.settingRepo.findOne({ where: { key: PLATFORM_SETTING_TRIAL_DAYS } });
    if (!row) {
      row = this.settingRepo.create({ key: PLATFORM_SETTING_TRIAL_DAYS, value });
    } else {
      row.value = value;
    }
    await this.settingRepo.save(row);
    return parseInt(value, 10);
  }

  /**
   * Reject register when a corporate domain already used a trial.
   * Public mailboxes are always allowed.
   */
  async assertTrialDomainAvailable(email: string): Promise<void> {
    const domain = emailDomain(email);
    if (!domain || !isCorporateTrialDomain(domain)) return;

    const existing = await this.trialDomainRepo.findOne({ where: { domain } });
    if (existing) {
      throw new ConflictException(
        `A free trial has already been used for the email domain ${domain}. ` +
          `Please subscribe or contact support. [${BILLING_ERROR.TRIAL_DOMAIN_USED}]`,
      );
    }
  }

  /** Start trial on a newly created tenant and record corporate domain if applicable. */
  async startTrialForNewTenant(tenantId: string, ownerEmail: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new ConflictException('Tenant not found when starting trial');
    }

    const days = await this.getTrialDays();
    const now = new Date();
    const ends = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const domain = emailDomain(ownerEmail);

    tenant.billingStatus = 'trial';
    tenant.trialStartsAt = now;
    tenant.trialEndsAt = ends;
    tenant.trialEmailDomain = domain;
    tenant.includedClientAllowance = BILLING_INCLUDED_CLIENTS;

    if (domain && isCorporateTrialDomain(domain)) {
      try {
        const row = this.trialDomainRepo.create({
          domain,
          tenantId: tenant.id,
          consumedAt: now,
        });
        await this.trialDomainRepo.save(row);
      } catch (err) {
        this.logger.warn(`Could not record trial domain ${domain}: ${String(err)}`);
        throw new ConflictException(
          `A free trial has already been used for the email domain ${domain}. ` +
            `Please subscribe or contact support. [${BILLING_ERROR.TRIAL_DOMAIN_USED}]`,
        );
      }
    }

    return this.tenantRepo.save(tenant);
  }

  /** Support path: allow a corporate domain to start a new trial later. */
  async clearTrialDomain(domainRaw: string): Promise<{ cleared: boolean; domain: string }> {
    const domain = domainRaw.trim().toLowerCase();
    if (!domain) {
      throw new NotFoundException('Domain is required');
    }
    const existing = await this.trialDomainRepo.findOne({ where: { domain } });
    if (!existing) {
      throw new NotFoundException(`No trial lock found for domain ${domain}`);
    }
    await this.trialDomainRepo.remove(existing);
    return { cleared: true, domain };
  }

  /** Throw UnauthorizedException when firm billing blocks access. */
  assertTenantBillingAccess(tenant: Tenant): void {
    const result = evaluateBillingAccess(tenant);
    if (!result.allowed) {
      throw new UnauthorizedException(result.message ?? 'Subscription required');
    }
  }

  async assertTenantIdBillingAccess(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new UnauthorizedException(
        'This firm account has been deactivated. Please contact support.',
      );
    }
    this.assertTenantBillingAccess(tenant);
  }

  /**
   * Billable clients = all non-deleted client rows for the firm
   * (pending invite / unauthorised still count; portal-only included for v1).
   */
  async countBillableClients(tenantId: string): Promise<number> {
    return this.clientRepo.count({ where: { tenantId } });
  }

  async quoteForTenant(tenantId: string): Promise<
    MonthlyFeeQuote & {
      allowance: number;
      billingStatus: string;
      trialStartsAt: string | null;
      trialEndsAt: string | null;
      /** Stripe period end — null until Checkout/webhooks land. */
      nextRenewalAt: string | null;
      hasStripeCustomer: boolean;
    }
  > {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const count = await this.countBillableClients(tenantId);
    const quote = calcMonthlyFee(count);
    return {
      ...quote,
      allowance: tenant?.includedClientAllowance ?? BILLING_INCLUDED_CLIENTS,
      billingStatus: tenant?.billingStatus ?? 'active',
      trialStartsAt: tenant?.trialStartsAt ? new Date(tenant.trialStartsAt).toISOString() : null,
      trialEndsAt: tenant?.trialEndsAt ? new Date(tenant.trialEndsAt).toISOString() : null,
      nextRenewalAt: tenant?.billingPeriodEndsAt
        ? new Date(tenant.billingPeriodEndsAt).toISOString()
        : null,
      hasStripeCustomer: !!tenant?.stripeCustomerId,
    };
  }

  /**
   * Stripe webhook helper — always emails the firm owner (billing-critical).
   * No-op (logged) if owner cannot be resolved.
   */
  async notifyOwnerPaymentFailed(tenantId: string): Promise<void> {
    const ctx = await this.ownerMailContext(tenantId);
    if (!ctx) return;
    await this.mailService.sendPaymentFailedEmail(ctx.email, {
      firstName: ctx.firstName,
      firmName: ctx.firmName,
    });
  }

  /** Stripe webhook helper — payment succeeded / invoice.paid. */
  async notifyOwnerPaymentSucceeded(
    tenantId: string,
    opts?: { amountLabel?: string | null },
  ): Promise<void> {
    const ctx = await this.ownerMailContext(tenantId);
    if (!ctx) return;
    await this.mailService.sendPaymentSucceededEmail(ctx.email, {
      firstName: ctx.firstName,
      firmName: ctx.firmName,
      amountLabel: opts?.amountLabel ?? null,
    });
  }

  private async ownerMailContext(
    tenantId: string,
  ): Promise<{ email: string; firstName: string; firmName: string } | null> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      this.logger.warn(`notifyOwner*: tenant ${tenantId} not found`);
      return null;
    }

    const owner = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.role', 'r')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('r.name = :owner', { owner: 'owner' })
      .andWhere('u.is_active = true')
      .orderBy('u.createdAt', 'ASC')
      .getOne();

    const email = owner?.email ?? tenant.contactEmail ?? null;
    if (!email) {
      this.logger.warn(`notifyOwner*: no owner/contact email for tenant ${tenantId}`);
      return null;
    }

    return {
      email,
      firstName: owner?.firstName ?? 'there',
      firmName: tenant.firmName,
    };
  }
}

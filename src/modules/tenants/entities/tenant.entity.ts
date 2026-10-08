import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Tenants table — each accounting firm/practice is one tenant.
 * Created automatically when an agent registers.
 * All domain records (clients, submissions, etc.) must reference tenant_id.
 */
@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ name: 'firm_name', type: 'varchar', length: 200 })
  firmName: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 200, nullable: true })
  contactName?: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address?: string;

  @Column({ name: 'postcode', type: 'varchar', length: 20, nullable: true })
  postcode?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Optional note when a platform admin deactivates the firm. Cleared on reactivate. */
  @Column({ name: 'deactivation_reason', type: 'text', nullable: true })
  deactivationReason?: string | null;

  @Column({ name: 'deactivated_at', type: 'datetime', nullable: true })
  deactivatedAt?: Date | null;

  /**
   * Billing lifecycle. Existing firms migrate as `active`.
   * New signups are set to `trial` by BillingService.
   */
  @Column({ name: 'billing_status', type: 'varchar', length: 32, default: 'active' })
  billingStatus: string;

  @Column({ name: 'trial_starts_at', type: 'datetime', nullable: true })
  trialStartsAt?: Date | null;

  @Column({ name: 'trial_ends_at', type: 'datetime', nullable: true })
  trialEndsAt?: Date | null;

  @Column({ name: 'trial_email_domain', type: 'varchar', length: 255, nullable: true })
  trialEmailDomain?: string | null;

  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 255, nullable: true })
  stripeCustomerId?: string | null;

  @Column({ name: 'stripe_subscription_id', type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId?: string | null;

  /** Stripe subscription current_period_end (UTC). */
  @Column({ name: 'billing_period_ends_at', type: 'datetime', nullable: true })
  billingPeriodEndsAt?: Date | null;

  @Column({ name: 'included_client_allowance', type: 'int', default: 50 })
  includedClientAllowance: number;

  /** Optional cache; live counts use BillingService.countBillableClients. */
  @Column({ name: 'billable_client_count', type: 'int', nullable: true })
  billableClientCount?: number | null;

  /** Set when the day−2 trial-ending reminder was sent (idempotent cron). */
  @Column({ name: 'trial_ending_email_sent_at', type: 'datetime', nullable: true })
  trialEndingEmailSentAt?: Date | null;

  /** Set when the trial-expired notice was sent (idempotent cron). */
  @Column({ name: 'trial_expired_email_sent_at', type: 'datetime', nullable: true })
  trialExpiredEmailSentAt?: Date | null;
}

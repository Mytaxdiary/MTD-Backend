import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Stripe from 'stripe';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { BILLING_INCLUDED_CLIENTS } from './billing.constants';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingStripeService {
  private readonly logger = new Logger(BillingStripeService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly stripeService: StripeService,
    private readonly billingService: BillingService,
    private readonly config: ConfigService,
  ) {}

  private frontendUrl(): string {
    return (this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  private assertOwner(role: string): void {
    if (role !== 'owner') {
      throw new ForbiddenException('Only the firm owner can manage billing');
    }
  }

  /**
   * Create a Stripe Checkout Session for the tenant's current billable quantity.
   * Allowed even when trial has expired (JWT path is billing-exempt).
   */
  async createCheckoutSession(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<{ url: string }> {
    this.assertOwner(role);
    if (!this.stripeService.isConfigured) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Firm not found');

    if (tenant.billingStatus === 'active' && tenant.stripeSubscriptionId) {
      throw new BadRequestException(
        'This firm already has an active subscription. Use Manage billing instead.',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const email = user?.email ?? tenant.contactEmail ?? undefined;
    const billable = await this.billingService.countBillableClients(tenantId);
    const allowance = tenant.includedClientAllowance ?? BILLING_INCLUDED_CLIENTS;
    const extraQty = Math.max(0, billable - allowance);

    const stripe = this.stripeService.stripe;
    let customerId = tenant.stripeCustomerId ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: tenant.firmName,
        metadata: { tenantId: tenant.id },
      });
      customerId = customer.id;
      tenant.stripeCustomerId = customerId;
      await this.tenantRepo.save(tenant);
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: this.stripeService.priceBaseId, quantity: 1 },
    ];
    if (extraQty > 0) {
      lineItems.push({ price: this.stripeService.priceExtraId, quantity: extraQty });
    }

    const base = this.frontendUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: tenant.id,
      line_items: lineItems,
      success_url: `${base}/settings?section=billing&checkout=success`,
      cancel_url: `${base}/settings?section=billing&checkout=cancelled`,
      metadata: { tenantId: tenant.id },
      subscription_data: {
        metadata: { tenantId: tenant.id },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe Checkout did not return a URL');
    }

    return { url: session.url };
  }

  /** Stripe Customer Portal for payment method / invoices. */
  async createPortalSession(tenantId: string, role: string): Promise<{ url: string }> {
    this.assertOwner(role);
    if (!this.stripeService.isConfigured) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Firm not found');
    if (!tenant.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer yet. Subscribe first.');
    }

    const session = await this.stripeService.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${this.frontendUrl()}/settings?section=billing`,
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ received: true }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Webhook signature verify failed: ${String(err)}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.onSubscriptionChanged(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.paid':
          await this.onInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          this.logger.debug(`Ignoring Stripe event ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Webhook handler error for ${event.type}: ${String(err)}`);
      throw err;
    }

    return { received: true };
  }

  private async findTenantForStripe(opts: {
    tenantId?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
  }): Promise<Tenant | null> {
    if (opts.tenantId) {
      const byMeta = await this.tenantRepo.findOne({ where: { id: opts.tenantId } });
      if (byMeta) return byMeta;
    }
    if (opts.subscriptionId) {
      const bySub = await this.tenantRepo.findOne({
        where: { stripeSubscriptionId: opts.subscriptionId },
      });
      if (bySub) return bySub;
    }
    if (opts.customerId) {
      return this.tenantRepo.findOne({ where: { stripeCustomerId: opts.customerId } });
    }
    return null;
  }

  private periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
    const end =
      sub.items?.data?.[0]?.current_period_end ??
      (sub as { current_period_end?: number }).current_period_end;
    if (!end || typeof end !== 'number') return null;
    return new Date(end * 1000);
  }

  private billingStatusFromSubscription(sub: Stripe.Subscription): string {
    if (sub.status === 'active' || sub.status === 'trialing') return 'active';
    if (sub.status === 'past_due' || sub.status === 'unpaid') return 'past_due';
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return 'cancelled';
    return 'past_due';
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId ?? session.client_reference_id;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    const tenant = await this.findTenantForStripe({
      tenantId,
      customerId,
      subscriptionId,
    });
    if (!tenant) {
      this.logger.warn(`checkout.session.completed: no tenant for ${tenantId ?? customerId}`);
      return;
    }

    if (customerId) tenant.stripeCustomerId = customerId;
    if (subscriptionId) tenant.stripeSubscriptionId = subscriptionId;
    tenant.billingStatus = 'active';

    if (subscriptionId) {
      try {
        const sub = await this.stripeService.stripe.subscriptions.retrieve(subscriptionId);
        tenant.billingPeriodEndsAt = this.periodEndFromSubscription(sub);
      } catch (err) {
        this.logger.warn(`Could not load subscription ${subscriptionId}: ${String(err)}`);
      }
    }

    await this.tenantRepo.save(tenant);
    this.logger.log(`Tenant ${tenant.id} activated via Checkout`);
  }

  private async onSubscriptionChanged(sub: Stripe.Subscription): Promise<void> {
    const tenantId = sub.metadata?.tenantId;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    const tenant = await this.findTenantForStripe({
      tenantId,
      customerId,
      subscriptionId: sub.id,
    });
    if (!tenant) {
      this.logger.warn(`subscription event: no tenant for ${sub.id}`);
      return;
    }

    tenant.stripeSubscriptionId = sub.id;
    if (customerId) tenant.stripeCustomerId = customerId;
    tenant.billingStatus = this.billingStatusFromSubscription(sub);
    tenant.billingPeriodEndsAt = this.periodEndFromSubscription(sub);

    if (sub.status === 'canceled') {
      tenant.billingStatus = 'cancelled';
    }

    await this.tenantRepo.save(tenant);
  }

  private tenantIdFromInvoice(invoice: Stripe.Invoice): {
    tenantId?: string;
    customerId?: string;
    subscriptionId?: string;
  } {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const legacySub = (invoice as { subscription?: string | { id: string } | null }).subscription;
    const parentSub = invoice.parent?.subscription_details?.subscription;
    const rawSub = parentSub ?? legacySub;
    const subscriptionId =
      typeof rawSub === 'string'
        ? rawSub
        : rawSub && typeof rawSub === 'object' && 'id' in rawSub
          ? rawSub.id
          : undefined;
    const tenantId =
      invoice.parent?.subscription_details?.metadata?.tenantId ??
      invoice.metadata?.tenantId ??
      undefined;
    return { tenantId, customerId, subscriptionId };
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const refs = this.tenantIdFromInvoice(invoice);
    const tenant = await this.findTenantForStripe(refs);
    if (!tenant) {
      this.logger.warn(`invoice.paid: no tenant for customer ${refs.customerId}`);
      return;
    }

    if (refs.customerId) tenant.stripeCustomerId = refs.customerId;
    if (refs.subscriptionId) tenant.stripeSubscriptionId = refs.subscriptionId;
    tenant.billingStatus = 'active';

    if (refs.subscriptionId) {
      try {
        const sub = await this.stripeService.stripe.subscriptions.retrieve(refs.subscriptionId);
        tenant.billingPeriodEndsAt = this.periodEndFromSubscription(sub);
      } catch {
        /* ignore */
      }
    }

    await this.tenantRepo.save(tenant);

    const amount =
      typeof invoice.amount_paid === 'number' ? `£${(invoice.amount_paid / 100).toFixed(2)}` : null;
    await this.billingService.notifyOwnerPaymentSucceeded(tenant.id, { amountLabel: amount });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const refs = this.tenantIdFromInvoice(invoice);
    const tenant = await this.findTenantForStripe(refs);
    if (!tenant) {
      this.logger.warn(`invoice.payment_failed: no tenant for customer ${refs.customerId}`);
      return;
    }

    tenant.billingStatus = 'past_due';
    await this.tenantRepo.save(tenant);
    await this.billingService.notifyOwnerPaymentFailed(tenant.id);
  }
}

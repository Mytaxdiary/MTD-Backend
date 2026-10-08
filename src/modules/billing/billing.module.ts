import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { PlatformSetting } from './entities/platform-setting.entity';
import { TrialEmailDomain } from './entities/trial-email-domain.entity';
import { BillingService } from './billing.service';
import { BillingStripeService } from './billing-stripe.service';
import { StripeService } from './stripe.service';
import { BillingController } from './billing.controller';
import { BillingPublicController } from './billing-public.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingMailScheduler } from './billing-mail.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Client, PlatformSetting, TrialEmailDomain, User]),
    MailModule,
  ],
  controllers: [BillingController, BillingPublicController, BillingWebhookController],
  providers: [BillingService, BillingStripeService, StripeService, BillingMailScheduler],
  exports: [BillingService, BillingStripeService],
})
export class BillingModule {}

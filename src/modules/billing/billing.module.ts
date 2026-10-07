import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { TrialEmailDomain } from './entities/trial-email-domain.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Client, PlatformSetting, TrialEmailDomain])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

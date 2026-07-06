import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Client } from './entities/client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { HmrcModule } from '../hmrc/hmrc.module';
import { MailModule } from '../mail/mail.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';
import { AppNotificationsModule } from '../app-notifications/app-notifications.module';
import { ClientPortalModule } from '../client-portal/client-portal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Tenant, NotificationPreferences]),
    HmrcModule,
    MailModule,
    AppNotificationsModule,
    ClientPortalModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}

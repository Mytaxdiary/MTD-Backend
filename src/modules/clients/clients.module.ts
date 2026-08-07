import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Client } from './entities/client.entity';
import { ClientNote } from './entities/client-note.entity';
import { ClientStatusHistory } from './entities/client-status-history.entity';
import { ClientsService } from './clients.service';
import { ClientPipelineService } from './client-pipeline.service';
import { ClientsController } from './clients.controller';
import { HmrcModule } from '../hmrc/hmrc.module';
import { MailModule } from '../mail/mail.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';
import { User } from '../users/entities/user.entity';
import { AppNotificationsModule } from '../app-notifications/app-notifications.module';
import { ClientPortalModule } from '../client-portal/client-portal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientNote,
      ClientStatusHistory,
      Tenant,
      NotificationPreferences,
      User,
    ]),
    HmrcModule,
    MailModule,
    AppNotificationsModule,
    ClientPortalModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService, ClientPipelineService],
  exports: [ClientsService, ClientPipelineService],
})
export class ClientsModule {}

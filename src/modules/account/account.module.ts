import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientNote } from '../clients/entities/client-note.entity';
import { ChaseLog } from '../chase-logs/entities/chase-log.entity';
import { ChaseTemplate } from '../chase-templates/entities/chase-template.entity';
import { AppNotification } from '../app-notifications/entities/app-notification.entity';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';
import { PortalMessage } from '../client-portal/entities/portal-message.entity';
import { PortalFile } from '../client-portal/entities/portal-file.entity';
import { ClientUser } from '../client-portal/entities/client-user.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { DeletionRequest } from './entities/deletion-request.entity';
import { MailModule } from '../mail/mail.module';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    TypeOrmModule.forFeature([
      User,
      Tenant,
      Client,
      ClientNote,
      ChaseLog,
      ChaseTemplate,
      AppNotification,
      NotificationPreferences,
      PortalMessage,
      PortalFile,
      ClientUser,
      HmrcConnection,
      DeletionRequest,
    ]),
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}

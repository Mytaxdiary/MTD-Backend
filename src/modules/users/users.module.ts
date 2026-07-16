import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientNote } from '../clients/entities/client-note.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { ChaseTemplate } from '../chase-templates/entities/chase-template.entity';
import { ChaseLog } from '../chase-logs/entities/chase-log.entity';
import { AppNotification } from '../app-notifications/entities/app-notification.entity';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';
import { ClientUser } from '../client-portal/entities/client-user.entity';
import { PortalMessage } from '../client-portal/entities/portal-message.entity';
import { PortalFile } from '../client-portal/entities/portal-file.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Tenant,
      Client,
      ClientNote,
      HmrcConnection,
      ChaseTemplate,
      ChaseLog,
      AppNotification,
      NotificationPreferences,
      ClientUser,
      PortalMessage,
      PortalFile,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

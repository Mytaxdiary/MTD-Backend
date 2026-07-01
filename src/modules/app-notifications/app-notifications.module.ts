import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppNotification } from './entities/app-notification.entity';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotificationsController } from './app-notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppNotification])],
  providers: [AppNotificationsService],
  controllers: [AppNotificationsController],
  exports: [AppNotificationsService],
})
export class AppNotificationsModule {}

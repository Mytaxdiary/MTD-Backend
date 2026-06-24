import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChaseLog } from './entities/chase-log.entity';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { MailModule } from '../mail/mail.module';
import { ChaseLogsService } from './chase-logs.service';
import { ChaseLogsController } from './chase-logs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChaseLog, Client, Tenant]),
    MailModule,
  ],
  controllers: [ChaseLogsController],
  providers: [ChaseLogsService],
  exports: [ChaseLogsService],
})
export class ChaseLogsModule {}

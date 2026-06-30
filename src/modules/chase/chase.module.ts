import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ChaseLogsModule } from '../chase-logs/chase-logs.module';
import { ChaseTemplatesModule } from '../chase-templates/chase-templates.module';
import { ChaseService } from './chase.service';
import { ChaseController } from './chase.controller';
import { ChaseSchedulerService } from './chase-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Tenant]),
    ChaseLogsModule,
    ChaseTemplatesModule,
  ],
  controllers: [ChaseController],
  providers: [ChaseService, ChaseSchedulerService],
  exports: [ChaseService],
})
export class ChaseModule {}

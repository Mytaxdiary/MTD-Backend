import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { ChaseLogsModule } from '../chase-logs/chase-logs.module';
import { ClientsModule } from '../clients/clients.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Client]), ChaseLogsModule, ClientsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}

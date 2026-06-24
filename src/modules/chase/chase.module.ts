import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { ChaseLogsModule } from '../chase-logs/chase-logs.module';
import { ChaseService } from './chase.service';
import { ChaseController } from './chase.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client]),
    ChaseLogsModule,
  ],
  controllers: [ChaseController],
  providers: [ChaseService],
  exports: [ChaseService],
})
export class ChaseModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HmrcConnection } from './entities/hmrc-connection.entity';
import { HmrcService } from './hmrc.service';
import { HmrcController } from './hmrc.controller';
import { HmrcApiClient } from './hmrc-api.client';
import { HmrcFraudHeadersBuilder } from './hmrc-fraud-headers.builder';
import { HmrcTokenSchedulerService } from './hmrc-token-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([HmrcConnection])],
  controllers: [HmrcController],
  providers: [HmrcService, HmrcApiClient, HmrcFraudHeadersBuilder, HmrcTokenSchedulerService],
  exports: [HmrcService, HmrcApiClient],
})
export class HmrcModule {}

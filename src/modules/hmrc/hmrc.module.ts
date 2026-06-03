import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HmrcConnection } from './entities/hmrc-connection.entity';
import { HmrcService } from './hmrc.service';
import { HmrcController } from './hmrc.controller';
import { HmrcApiClient } from './hmrc-api.client';
import { HmrcFraudHeadersBuilder } from './hmrc-fraud-headers.builder';

@Module({
  imports: [TypeOrmModule.forFeature([HmrcConnection])],
  controllers: [HmrcController],
  providers: [HmrcService, HmrcApiClient, HmrcFraudHeadersBuilder],
  exports: [HmrcService, HmrcApiClient],
})
export class HmrcModule {}

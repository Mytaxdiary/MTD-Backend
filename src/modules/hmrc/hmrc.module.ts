import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HmrcConnection } from './entities/hmrc-connection.entity';
import { HmrcService } from './hmrc.service';
import { HmrcController } from './hmrc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HmrcConnection])],
  controllers: [HmrcController],
  providers: [HmrcService],
  exports: [HmrcService],
})
export class HmrcModule {}

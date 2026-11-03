import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OUTREACH_ENTITIES } from './entities';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';

/**
 * Prospect outreach CRM — schema + admin APIs.
 * Auth: existing platform admin JWT (@AuthAudience('admin')).
 */
@Module({
  imports: [TypeOrmModule.forFeature(OUTREACH_ENTITIES)],
  controllers: [OutreachController],
  providers: [OutreachService],
  exports: [TypeOrmModule, OutreachService],
})
export class OutreachModule {}

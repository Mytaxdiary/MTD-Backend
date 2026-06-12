import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChaseTemplate } from './entities/chase-template.entity';
import { ChaseTemplatesService } from './chase-templates.service';
import { ChaseTemplatesController } from './chase-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChaseTemplate])],
  controllers: [ChaseTemplatesController],
  providers: [ChaseTemplatesService],
  exports: [ChaseTemplatesService],
})
export class ChaseTemplatesModule {}

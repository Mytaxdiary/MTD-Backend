import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemErrorLog } from './entities/system-error-log.entity';
import { ErrorLogsService } from './error-logs.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemErrorLog])],
  providers: [ErrorLogsService],
  exports: [ErrorLogsService],
})
export class ErrorLogsModule {}

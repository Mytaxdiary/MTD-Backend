import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { EmailConnectionsModule } from '../email-connections/email-connections.module';

@Module({
  imports: [ConfigModule, forwardRef(() => EmailConnectionsModule)],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

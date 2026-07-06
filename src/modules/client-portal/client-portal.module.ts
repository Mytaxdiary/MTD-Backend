import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientUser } from './entities/client-user.entity';
import { PortalMessage } from './entities/portal-message.entity';
import { PortalFile } from './entities/portal-file.entity';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { PortalService } from './portal.service';
import { PortalAuthController } from './portal-auth.controller';
import { PortalController } from './portal.controller';
import { PortalJwtStrategy } from './strategies/portal-jwt.strategy';
import { PortalJwtGuard } from './guards/portal-jwt.guard';
import { HmrcModule } from '../hmrc/hmrc.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientUser, PortalMessage, PortalFile, Client, Tenant]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret') ?? 'dev-fallback-secret',
        signOptions: { expiresIn: '24h' },
      }),
    }),
    HmrcModule,
    MailModule,
  ],
  controllers: [PortalAuthController, PortalController],
  providers: [PortalService, PortalJwtStrategy, PortalJwtGuard],
  exports: [PortalService],
})
export class ClientPortalModule {}

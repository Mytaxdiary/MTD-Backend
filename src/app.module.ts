import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import databaseConfig, { typeOrmConfig } from './config/database.config';
import authConfig from './config/auth.config';
import mailConfig from './config/mail.config';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { HmrcModule } from './modules/hmrc/hmrc.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ChaseTemplatesModule } from './modules/chase-templates/chase-templates.module';
import { ChaseLogsModule } from './modules/chase-logs/chase-logs.module';
import { ChaseModule } from './modules/chase/chase.module';
import { AppNotificationsModule } from './modules/app-notifications/app-notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import hmrcConfig from './config/hmrc.config';

@Module({
  imports: [
    // Global config — load all namespaces and validate env on startup
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, mailConfig, hmrcConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // Database — MySQL via TypeORM
    TypeOrmModule.forRootAsync({
      useFactory: () => typeOrmConfig(),
    }),

    // Rate limiting — applied globally via APP_GUARD below
    // 'default': 100 req/min for all routes
    // 'auth': 10 req/min override for sensitive auth endpoints
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('app.throttleTtl', 60) * 1000,
            limit: config.get<number>('app.throttleLimit', 100),
          },
          {
            name: 'auth',
            ttl: 60_000,
            limit: 10,
          },
        ],
      }),
    }),

    // Cron jobs — required before any module that uses @Cron()
    ScheduleModule.forRoot(),

    HealthModule,
    AuthModule,
    TenantsModule,
    HmrcModule,
    ClientsModule,
    ChaseTemplatesModule,
    ChaseLogsModule,
    ChaseModule,
    AppNotificationsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply rate limiting globally to all routes
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Enquiry } from '../enquiries/entities/enquiry.entity';
import { Client } from '../clients/entities/client.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TypeOrmModule.forFeature([Tenant, User, Enquiry, Client, HmrcConnection, RefreshToken]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

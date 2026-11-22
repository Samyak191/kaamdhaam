import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { ContractsModule } from './contracts/contracts.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    DatabaseModule,
    AuthModule,
    IdentityModule,
    MarketplaceModule,
    ContractsModule,
    MessagingModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}

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
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { name: 'read', ttl: 60000, limit: config.getOrThrow<number>('RATE_LIMIT_PER_MINUTE'),
          skipIf: context => !['GET', 'HEAD'].includes(context.switchToHttp().getRequest().method) },
        { name: 'write', ttl: 60000, limit: config.getOrThrow<number>('RATE_LIMIT_WRITE_PER_MINUTE'),
          skipIf: context => ['GET', 'HEAD'].includes(context.switchToHttp().getRequest().method) },
      ],
    }),
    DatabaseModule,
    AuthModule,
    IdentityModule,
    MarketplaceModule,
    ContractsModule,
    MessagingModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { API_PREFIX, getAppConfiguration, type AppConfiguration } from './configuration';

export function configureApp(app: INestApplication): AppConfiguration {
  const config = getAppConfiguration(app.get(ConfigService));
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: config.corsOrigins, credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  return config;
}

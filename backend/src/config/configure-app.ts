import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { requestContextMiddleware } from '../common/request-context.middleware';
import { API_PREFIX, getAppConfiguration, type AppConfiguration } from './configuration';

export function configureApp(app: INestApplication): AppConfiguration {
  const config = getAppConfiguration(app.get(ConfigService));
  const expressApp = app as NestExpressApplication;
  // 0 = trust no proxy headers (direct exposure). 1 = exactly one trusted reverse proxy (Nginx) in front.
  app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxyHops);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false }));
  expressApp.useBodyParser('json', { limit: '32kb' });
  expressApp.useBodyParser('urlencoded', { limit: '8kb', extended: false });
  app.use(requestContextMiddleware);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: config.corsOrigins,
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  return config;
}

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { API_PREFIX, SERVICE_NAME } from './config/configuration';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = configureApp(app);
  if (config.nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('KaamDhaam API').setVersion('v1')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }).build());
    SwaggerModule.setup('v1/docs', app, document, { jsonDocumentUrl: 'v1/openapi.json' });
  }
  await app.listen(config.port, config.host);
  Logger.log(
    JSON.stringify({
      event: 'api_started',
      service: SERVICE_NAME,
      address: `http://${config.host.includes(':') ? `[${config.host}]` : config.host}:${config.port}/${API_PREFIX}`,
      nodeEnv: config.nodeEnv,
      allowedOriginCount: config.corsOrigins.length,
    }),
    'Bootstrap',
  );
}

void bootstrap().catch((error: unknown) => {
  Logger.error('Backend startup failed. Check configuration and database availability.', undefined, 'Bootstrap');
  process.exitCode = 1;
});

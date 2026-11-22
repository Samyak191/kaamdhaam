import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { PrismaService } from '../src/database/prisma.service';

describe('Health API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ isReady: async () => false }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns HTTP 200 and the exact health JSON at /v1/health', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect({ status: 'ok', service: 'kaamdham-api' });
  });

  it('returns HTTP 404 for an unknown endpoint', async () => {
    await request(app.getHttpServer()).get('/v1/unknown').expect(404);
  });

  it('allows only configured browser origins', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173');

    const denied = await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'https://unlisted.example.com')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps readiness independent of liveness and rejects anonymous identity calls', async () => {
    await request(app.getHttpServer()).get('/v1/ready').expect(503)
      .expect({ status: 'not_ready', database: 'disconnected' });
    await request(app.getHttpServer()).get('/v1/me').expect(401);
    await request(app.getHttpServer()).get('/v1/me').set('Authorization', 'Basic abc').expect(401);
  });
});

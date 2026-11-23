import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { PrismaService } from '../src/database/prisma.service';

describe('Health API (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ isReady: async () => false }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns HTTP 200 and the exact health JSON at /v1/health', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect({ status: 'ok', service: 'kaamdham-api' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rejects oversized JSON before processing a protected mutation', async () => {
    await request(app.getHttpServer()).post('/v1/jobs')
      .set('Content-Type', 'application/json')
      .send({ description: 'x'.repeat(40000) }).expect(413);
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

import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { PrismaService } from '../src/database/prisma.service';

@Controller('rate-test')
class RateTestController {
  @Get()
  @Throttle({ read: { limit: 2, ttl: 60000 } })
  read() { return { ok: true }; }
}

describe('HTTP rate limiting', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [RateTestController] })
      .overrideProvider(PrismaService).useValue({ isReady: async () => true }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('returns 429 on the third request to one route from one client', async () => {
    await request(app.getHttpServer()).get('/v1/rate-test').expect(200);
    await request(app.getHttpServer()).get('/v1/rate-test').expect(200);
    await request(app.getHttpServer()).get('/v1/rate-test').expect(429);
  });
});

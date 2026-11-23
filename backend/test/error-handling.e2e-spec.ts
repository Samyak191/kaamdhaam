import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { PrismaService } from '../src/database/prisma.service';

@Controller('error-test')
class ErrorTestController {
  @Get('crash')
  crash(): never { throw new Error('internal detail: database password is hunter2'); }

  @Get('typed')
  typed(): never { throw new BadRequestException({ statusCode: 400, message: ['title must be longer'], error: 'Bad Request' }); }

  @Post('echo')
  echo(@Body() body: unknown): unknown { return body; }
}

describe('Error handling contract (e2e)', () => {
  let app: NestExpressApplication;
  let stderr: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [ErrorTestController] })
      .overrideProvider(PrismaService).useValue({ isReady: async () => true }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app);
    await app.init();
  });
  beforeEach(() => { stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true); });
  afterEach(() => { stderr.mockRestore(); });
  afterAll(async () => { await app.close(); });

  it('turns unexpected errors into a generic 500 that carries the request id but no internals', async () => {
    const response = await request(app.getHttpServer()).get('/v1/error-test/crash').expect(500);
    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: expect.stringContaining('X-Request-Id'),
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
    expect(JSON.stringify(response.body)).not.toMatch(/at .*\.ts:\d+/);
  });

  it('keeps actionable HttpException bodies for clients', async () => {
    const response = await request(app.getHttpServer()).get('/v1/error-test/typed').expect(400);
    expect(response.body).toEqual({ statusCode: 400, message: ['title must be longer'], error: 'Bad Request' });
  });

  it('rejects malformed JSON and non-whitelisted fields without leaking parser internals', async () => {
    const malformed = await request(app.getHttpServer()).post('/v1/error-test/echo')
      .set('Content-Type', 'application/json').send('{"broken":').expect(400);
    expect(JSON.stringify(malformed.body)).not.toMatch(/node_modules|\.js:\d+/);
    await request(app.getHttpServer()).post('/v1/jobs')
      .set('Content-Type', 'application/json').send({ title: 'x', status: 'OPEN' }).expect(401);
  });

  it('answers 404 for unknown routes with the standard Nest body', async () => {
    const response = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(response.body.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

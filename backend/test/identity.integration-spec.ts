import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { configureApp } from '../src/config/configure-app';
import { ConfigService } from '@nestjs/config';
import { JwtVerifierService } from '../src/auth/jwt-verifier.service';

describe('Identity API with real PostgreSQL and signed JWTs', () => {
  let app: INestApplication;
  let jwks: Server;
  let db: PrismaClient;
  let issuer: string;
  let privateKey: KeyLike;
  const subjectA = randomUUID();
  const subjectB = randomUUID();
  const subjectC = randomUUID();
  const subjectD = randomUUID();
  let userAId: string;
  let organizationId: string;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('Set TEST_DATABASE_URL to isolated kaamdham_test');
    const target = new URL(url);
    if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/kaamdham_test') {
      throw new Error('Integration tests require a localhost kaamdham_test database');
    }
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = 'test';
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    const publicKey = await exportJWK(keys.publicKey);
    publicKey.kid = 'integration-key';
    publicKey.alg = 'RS256';
    jwks = createServer((_req, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ keys: [publicKey] }));
    });
    await new Promise<void>(resolve => jwks.listen(0, '127.0.0.1', resolve));
    const address = jwks.address();
    if (!address || typeof address === 'string') throw new Error('No JWKS listener');
    issuer = `http://127.0.0.1:${address.port}/auth/v1`;
    process.env.SUPABASE_ISSUER = issuer;
    process.env.SUPABASE_JWKS_URL = `${issuer}/.well-known/jwks.json`;
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    await db.$connect();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    try {
      if (db) {
      const users = await db.user.findMany({ where: { authSubject: { in: [subjectA, subjectB, subjectC, subjectD] } }, select: { id: true } });
      const ids = users.map(x => x.id);
      const orgs = await db.clientOrganization.findMany({ where: { createdByUserId: { in: ids } }, select: { id: true } });
      await db.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { entityId: { in: ids } }, { entityId: { in: orgs.map(x => x.id) } }] } });
      await db.organizationMember.deleteMany({ where: { userId: { in: ids } } });
      await db.clientOrganization.deleteMany({ where: { createdByUserId: { in: ids } } });
      await db.freelancerProfile.deleteMany({ where: { userId: { in: ids } } });
      await db.userRoleAssignment.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      if (db) await db.$disconnect();
      if (jwks) await new Promise<void>(resolve => jwks.close(() => resolve()));
    }
  });

  const token = (subject: string, key?: KeyLike) => new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'integration-key' })
    .setIssuer(issuer).setAudience('authenticated').setSubject(subject).setIssuedAt().setExpirationTime('5m')
    .sign(key || privateKey);

  it('rejects anonymous and forged access, then provisions one role-free user under concurrency', async () => {
    await request(app.getHttpServer()).get('/v1/health').expect(200);
    await request(app.getHttpServer()).get('/v1/ready').expect(200)
      .expect({ status: 'ready', database: 'connected' });
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('KaamDhaam API').setVersion('v1').addBearerAuth().build());
    expect(document.paths['/v1/me']).toBeDefined();
    expect(document.components?.schemas?.MeResponseDto).toBeDefined();
    await request(app.getHttpServer()).get('/v1/me').expect(401);
    const forged = await generateKeyPair('RS256');
    await request(app.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${await token(subjectA, forged.privateKey)}`).expect(401);
    const auth = `Bearer ${await token(subjectA)}`;
    expect(app.get(ConfigService).get('SUPABASE_ISSUER')).toBe(issuer);
    await expect(app.get(JwtVerifierService).verify(auth.slice(7))).resolves.toBe(subjectA);
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(app.getHttpServer()).get('/v1/me').set('Authorization', auth).expect(200)));
    userAId = responses[0].body.id;
    expect(responses.every(x => x.body.id === userAId && x.body.roles.length === 0)).toBe(true);
    expect(await db.user.count({ where: { authSubject: subjectA } })).toBe(1);
    expect(await db.auditLog.count({ where: { actorUserId: userAId, action: 'USER_PROVISIONED' } })).toBe(1);
  });

  it('onboards dual roles atomically and rejects retry or privileged fields', async () => {
    const auth = `Bearer ${await token(subjectA)}`;
    const result = await request(app.getHttpServer()).post('/v1/me/onboarding').set('Authorization', auth)
      .send({ displayName: 'Alice', roles: ['CLIENT', 'FREELANCER'], headline: 'Designer', organizationName: 'Alice Studio' }).expect(201);
    expect(result.body.roles.sort()).toEqual(['CLIENT', 'FREELANCER']);
    organizationId = result.body.organizationIds[0];
    await request(app.getHttpServer()).post('/v1/me/onboarding').set('Authorization', auth)
      .send({ displayName: 'Alice', roles: ['CLIENT'], organizationName: 'Duplicate' }).expect(409);
    await request(app.getHttpServer()).post('/v1/me/roles').set('Authorization', auth).send({ role: 'ADMIN' }).expect(400);
    await request(app.getHttpServer()).post('/v1/organizations').set('Authorization', auth)
      .send({ name: 'Bad', createdByUserId: subjectB }).expect(400);
    await request(app.getHttpServer()).patch('/v1/me/profile').set('Authorization', auth)
      .send({ displayName: 'Changed', userId: subjectB }).expect(400);
    expect(await db.clientOrganization.count({ where: { createdByUserId: userAId } })).toBe(1);
    expect(await db.organizationMember.count({ where: { organizationId, userId: userAId, membershipRole: 'OWNER' } })).toBe(1);
    await expect(db.organizationMember.create({ data: { organizationId, userId: userAId, membershipRole: 'OWNER' } }))
      .rejects.toMatchObject({ code: 'P2002' });
    await expect(db.userRoleAssignment.create({ data: { userId: userAId, role: 'CLIENT' } }))
      .rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces membership and idempotent role addition', async () => {
    const authB = `Bearer ${await token(subjectB)}`;
    await request(app.getHttpServer()).get(`/v1/organizations/${organizationId}`).set('Authorization', authB).expect(404);
    await request(app.getHttpServer()).post('/v1/me/onboarding').set('Authorization', authB)
      .send({ displayName: 'Bob', roles: ['FREELANCER'] }).expect(201);
    await request(app.getHttpServer()).post('/v1/me/roles').set('Authorization', authB).send({ role: 'CLIENT' }).expect(201);
    await request(app.getHttpServer()).post('/v1/me/roles').set('Authorization', authB).send({ role: 'CLIENT' }).expect(201);
    const userB = await db.user.findUniqueOrThrow({ where: { authSubject: subjectB } });
    expect(await db.userRoleAssignment.count({ where: { userId: userB.id, role: 'CLIENT' } })).toBe(1);
    await request(app.getHttpServer()).get(`/v1/organizations/${organizationId}`).set('Authorization', authB).expect(404);
    await request(app.getHttpServer()).get(`/v1/organizations/${organizationId}`).set('Authorization', `Bearer ${await token(subjectA)}`).expect(200);
  });

  it('blocks suspension and writes security audit events', async () => {
    await db.user.update({ where: { id: userAId }, data: { status: 'SUSPENDED' } });
    await request(app.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${await token(subjectA)}`).expect(403);
    expect(await db.auditLog.count({ where: { actorUserId: userAId, action: 'ONBOARDING_COMPLETED' } })).toBe(1);
    expect(await db.auditLog.count({ where: { actorUserId: userAId, action: 'ORGANIZATION_CREATED' } })).toBe(1);
  });

  it('supports client-only onboarding and explicit organization creation', async () => {
    const auth = `Bearer ${await token(subjectC)}`;
    const attempts = await Promise.all(Array.from({ length: 2 }, () => request(app.getHttpServer())
      .post('/v1/me/onboarding').set('Authorization', auth).send({ displayName: 'Cara', roles: ['CLIENT'] })));
    expect(attempts.map(x => x.status).sort()).toEqual([201, 409]);
    const onboard = attempts.find(x => x.status === 201)!;
    expect(onboard.body.roles).toEqual(['CLIENT']);
    const created = await request(app.getHttpServer()).post('/v1/organizations').set('Authorization', auth)
      .send({ name: 'Cara Studio' }).expect(201);
    expect(created.body.name).toBe('Cara Studio');
    const listed = await request(app.getHttpServer()).get('/v1/me/organizations').set('Authorization', auth).expect(200);
    expect(listed.body.map((x: { id: string }) => x.id)).toContain(created.body.id);
    await request(app.getHttpServer()).get(`/v1/organizations/${created.body.id}`).set('Authorization', auth).expect(200);
  });

  it('rolls back all onboarding writes when a related record conflicts', async () => {
    const auth = `Bearer ${await token(subjectD)}`;
    const me = await request(app.getHttpServer()).get('/v1/me').set('Authorization', auth).expect(200);
    await db.freelancerProfile.create({ data: { userId: me.body.id } });
    await request(app.getHttpServer()).post('/v1/me/onboarding').set('Authorization', auth)
      .send({ displayName: 'Rollback Test', roles: ['CLIENT', 'FREELANCER'], organizationName: 'Should Not Exist' })
      .expect(409);
    const after = await request(app.getHttpServer()).get('/v1/me').set('Authorization', auth).expect(200);
    expect(after.body.displayName).toBeNull();
    expect(after.body.roles).toEqual([]);
    expect(after.body.organizationIds).toEqual([]);
    expect(await db.auditLog.count({ where: { actorUserId: me.body.id, action: 'ONBOARDING_COMPLETED' } })).toBe(0);
  });
});

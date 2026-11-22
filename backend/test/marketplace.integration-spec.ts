import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { configureApp } from '../src/config/configure-app';
import request from 'supertest';

jest.setTimeout(30000);

describe('Marketplace API with PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let jwks: Server;
  let issuer: string;
  let privateKey: KeyLike;
  const subjects = Array.from({ length: 4 }, () => randomUUID());
  const ids: string[] = [];
  let orgId: string;
  let jobId: string;
  let proposalAId: string;
  let proposalBId: string;
  const bearer = async (index: number) => `Bearer ${await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'market-test' }).setIssuer(issuer).setAudience('authenticated')
    .setSubject(subjects[index]).setIssuedAt().setExpirationTime('5m').sign(privateKey)}`;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('TEST_DATABASE_URL is required');
    const target = new URL(url);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/kaamdham_test') throw new Error('Only isolated local test DB allowed');
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = 'test';
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    const publicKey = await exportJWK(keys.publicKey);
    publicKey.kid = 'market-test'; publicKey.alg = 'RS256';
    jwks = createServer((_req, response) => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ keys: [publicKey] })); });
    await new Promise<void>(resolve => jwks.listen(0, '127.0.0.1', resolve));
    const address = jwks.address();
    if (!address || typeof address === 'string') throw new Error('JWKS listener unavailable');
    issuer = `http://127.0.0.1:${address.port}/auth/v1`;
    process.env.SUPABASE_ISSUER = issuer; process.env.SUPABASE_JWKS_URL = `${issuer}/.well-known/jwks.json`;
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    await db.$connect();
    for (let i = 0; i < subjects.length; i++) {
      const user = await db.user.create({ data: { authSubject: subjects[i], displayName: `Market Test ${i}` } });
      ids.push(user.id);
    }
    await db.userRoleAssignment.createMany({ data: [{ userId: ids[0], role: 'CLIENT' }, { userId: ids[0], role: 'FREELANCER' }, { userId: ids[1], role: 'FREELANCER' }, { userId: ids[2], role: 'FREELANCER' }, { userId: ids[3], role: 'CLIENT' }] });
    await db.freelancerProfile.createMany({ data: [{ userId: ids[1], headline: 'Backend developer' }, { userId: ids[2], headline: 'API developer' }] });
    const org = await db.clientOrganization.create({ data: { name: 'Market Test Org', slug: `market-test-${randomUUID()}`, createdByUserId: ids[0], members: { create: { userId: ids[0], membershipRole: 'OWNER' } } } });
    orgId = org.id;
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app); await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) {
      try {
        const proposals = await db.proposal.findMany({ where: { freelancerUserId: { in: ids } }, select: { id: true } });
        const pids = proposals.map(x => x.id);
        const jobs = await db.job.findMany({ where: { organizationId: orgId }, select: { id: true } });
        const jids = jobs.map(x => x.id);
        const contracts = await db.contract.findMany({ where: { jobId: { in: jids } }, select: { id: true } });
        const cids = contracts.map(x => x.id);
        const conversations = await db.conversation.findMany({ where: { contractId: { in: cids } }, select: { id: true } });
        const conversationIds = conversations.map(x => x.id);
        await db.conversationRead.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await db.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await db.conversation.deleteMany({ where: { id: { in: conversationIds } } });
        await db.notification.deleteMany({ where: { recipientUserId: { in: ids } } });
        await db.hireRequest.deleteMany({ where: { contractId: { in: cids } } });
        await db.milestoneSubmission.deleteMany({ where: { milestone: { contractId: { in: cids } } } });
        await db.contractMilestone.deleteMany({ where: { contractId: { in: cids } } });
        await db.contract.deleteMany({ where: { id: { in: cids } } });
        await db.proposalMilestone.deleteMany({ where: { proposalId: { in: pids } } });
        await db.proposal.deleteMany({ where: { id: { in: pids } } });
        await db.jobSkill.deleteMany({ where: { jobId: { in: jids } } });
        await db.job.deleteMany({ where: { id: { in: jids } } });
        const profiles = await db.freelancerProfile.findMany({ where: { userId: { in: ids } }, select: { id: true } });
        await db.freelancerSkill.deleteMany({ where: { profileId: { in: profiles.map(x => x.id) } } });
        await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
        await db.organizationMember.deleteMany({ where: { organizationId: orgId } });
        await db.clientOrganization.deleteMany({ where: { id: orgId } });
        await db.freelancerProfile.deleteMany({ where: { userId: { in: ids } } });
        await db.userRoleAssignment.deleteMany({ where: { userId: { in: ids } } });
        await db.user.deleteMany({ where: { id: { in: ids } } });
      } finally { await db.$disconnect(); }
    }
    if (jwks) await new Promise<void>(resolve => jwks.close(() => resolve()));
  });

  it('enforces public visibility, roles and organization ownership', async () => {
    await request(app.getHttpServer()).post('/v1/jobs').send({}).expect(401);
    const owner = await bearer(0); const outsider = await bearer(3);
    const created = await request(app.getHttpServer()).post('/v1/jobs').set('Authorization', owner).send({ organizationId: orgId, title: 'Build an API', description: 'Build a secure backend API for a real marketplace.', budgetPaise: 250000, skills: ['NestJS'] }).expect(201);
    jobId = created.body.id;
    expect(created.body.status).toBe('DRAFT');
    expect((await request(app.getHttpServer()).get(`/v1/me/jobs/${jobId}`).set('Authorization', owner).expect(200)).body.id).toBe(jobId);
    await request(app.getHttpServer()).get(`/v1/me/jobs/${jobId}`).set('Authorization', outsider).expect(404);
    expect((await request(app.getHttpServer()).get('/v1/jobs').expect(200)).body.items.some((x: any) => x.id === jobId)).toBe(false);
    await request(app.getHttpServer()).get(`/v1/jobs/${jobId}`).expect(404);
    await request(app.getHttpServer()).patch(`/v1/jobs/${jobId}`).set('Authorization', outsider).send({ title: 'Stolen job' }).expect(404);
    await request(app.getHttpServer()).post(`/v1/jobs/${jobId}/publish`).set('Authorization', owner).expect(201);
    await request(app.getHttpServer()).patch(`/v1/jobs/${jobId}`).set('Authorization', owner).send({ title: 'Changed job' }).expect(409);
    expect((await request(app.getHttpServer()).get(`/v1/jobs/${jobId}`).expect(200)).body.budgetPaise).toBe('250000');
    expect((await request(app.getHttpServer()).get('/v1/jobs?skill=nestjs&minBudgetPaise=200000&sort=budget_desc').expect(200)).body.items.some((x: any) => x.id === jobId)).toBe(true);
    await request(app.getHttpServer()).get('/v1/jobs?limit=10000').expect(400);
    await request(app.getHttpServer()).get(`/v1/jobs/${jobId}/proposals`).set('Authorization', outsider).expect(404);
    await request(app.getHttpServer()).post(`/v1/jobs/${jobId}/proposals`).set('Authorization', owner).send({ coverLetter: 'I would like to work on my own job here.', bidPaise: 200000, deliveryDays: 10 }).expect(403);
    const own = await db.proposal.create({ data: { jobId, freelancerUserId: ids[0], coverLetter: 'Database-seeded own proposal for authorization test.', bidPaise: 200000n, deliveryDays: 10 } });
    await request(app.getHttpServer()).post(`/v1/proposals/${own.id}/hire`).set('Authorization', owner).set('Idempotency-Key', `own-${randomUUID()}`).expect(403);
  });

  it('rejects duplicate proposals and protects private listings', async () => {
    const a = await bearer(1); const b = await bearer(2); const owner = await bearer(0);
    await request(app.getHttpServer()).patch('/v1/me/skills').set('Authorization', a).send({ skills: ['NestJS', 'PostgreSQL'] }).expect(200);
    expect((await request(app.getHttpServer()).get('/v1/freelancers?skill=nestjs').expect(200)).body.items.some((x: any) => x.displayName === 'Market Test 1')).toBe(true);
    const body = { coverLetter: 'I can build this backend API securely and on time.', bidPaise: 200000, deliveryDays: 10, milestones: [{ title: 'Working API', amountPaise: 200000 }] };
    await request(app.getHttpServer()).post(`/v1/jobs/${jobId}/proposals`).set('Authorization', a).send({ ...body, milestones: [{ title: 'Working API', amountPaise: 100000 }] }).expect(400);
    const first = await request(app.getHttpServer()).post(`/v1/jobs/${jobId}/proposals`).set('Authorization', a).send(body).expect(201);
    proposalAId = first.body.id;
    await request(app.getHttpServer()).post(`/v1/jobs/${jobId}/proposals`).set('Authorization', a).send(body).expect(409);
    const second = await request(app.getHttpServer()).post(`/v1/jobs/${jobId}/proposals`).set('Authorization', b).send({ ...body, bidPaise: 220000, milestones: [{ title: 'Working API', amountPaise: 220000 }] }).expect(201);
    proposalBId = second.body.id;
    expect((await request(app.getHttpServer()).get('/v1/me/proposals').set('Authorization', a).expect(200)).body.items.length).toBe(1);
    expect((await request(app.getHttpServer()).get(`/v1/jobs/${jobId}/proposals`).set('Authorization', owner).expect(200)).body.items.length).toBe(3);
    await request(app.getHttpServer()).post(`/v1/proposals/${proposalAId}/shortlist`).set('Authorization', owner).expect(201);
    await request(app.getHttpServer()).post(`/v1/proposals/${proposalAId}/shortlist`).set('Authorization', owner).expect(409);
  });

  it('hires exactly once under concurrent requests and replays the winning key', async () => {
    const owner = await bearer(0);
    const [a, b] = await Promise.all([
      request(app.getHttpServer()).post(`/v1/proposals/${proposalAId}/hire`).set('Authorization', owner).set('Idempotency-Key', `hire-a-${randomUUID()}`),
      request(app.getHttpServer()).post(`/v1/proposals/${proposalBId}/hire`).set('Authorization', owner).set('Idempotency-Key', `hire-b-${randomUUID()}`),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const winner = a.status === 201 ? a : b;
    const winnerId = a.status === 201 ? proposalAId : proposalBId;
    const key = winnerId === proposalAId ? (a.request.getHeader('Idempotency-Key') as string) : (b.request.getHeader('Idempotency-Key') as string);
    const notificationCount = await db.notification.count({ where: { relatedEntityId: winner.body.id } });
    const retry = await request(app.getHttpServer()).post(`/v1/proposals/${winnerId}/hire`).set('Authorization', owner).set('Idempotency-Key', key).expect(201);
    expect(retry.body.id).toBe(winner.body.id);
    expect(await db.notification.count({ where: { relatedEntityId: winner.body.id } })).toBe(notificationCount);
    await request(app.getHttpServer()).post(`/v1/proposals/${winnerId === proposalAId ? proposalBId : proposalAId}/hire`).set('Authorization', owner).set('Idempotency-Key', key).expect(409);
    expect(await db.contract.count({ where: { jobId } })).toBe(1);
    expect(await db.contractMilestone.count({ where: { contractId: winner.body.id } })).toBe(1);
    expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('HIRED');
    expect(await db.auditLog.count({ where: { action: 'PROPOSAL_HIRED', entityId: winner.body.id } })).toBe(1);
    await request(app.getHttpServer()).post(`/v1/jobs/${jobId}/proposals`).set('Authorization', await bearer(2)).send({ coverLetter: 'A late proposal should be rejected by the job state.', bidPaise: 200000, deliveryDays: 10 }).expect(404);
  });
  it('enforces skill, budget, foreign-key and one-contract database constraints', async () => {
    await expect(db.skill.create({ data: { name: 'Not-Normalized' } })).rejects.toThrow();
    await expect(db.job.create({ data: { organizationId: orgId, createdByUserId: ids[0], title: 'Invalid budget', description: 'Direct database constraint test on a draft job.', budgetPaise: 1n } })).rejects.toThrow();
    await expect(db.job.create({ data: { organizationId: randomUUID(), createdByUserId: ids[0], title: 'Invalid foreign key', description: 'Direct database foreign key constraint test.', budgetPaise: 10000n } })).rejects.toThrow();
    const contract = await db.contract.findUniqueOrThrow({ where: { jobId } });
    const otherProposalId = contract.proposalId === proposalAId ? proposalBId : proposalAId;
    await expect(db.contract.create({ data: { jobId, proposalId: otherProposalId, organizationId: orgId, freelancerUserId: contract.freelancerUserId, agreedPaise: 200000n } })).rejects.toThrow();
    expect(await db.contract.count({ where: { jobId } })).toBe(1);
  });
  it('keeps contract messages private, ordered, unread, and explicit-read', async () => {
    const contract = await db.contract.findUniqueOrThrow({ where: { jobId }, include: { conversation: true } });
    const conversationId = contract.conversation!.id;
    const freelancer = await bearer(contract.freelancerUserId === ids[1] ? 1 : 2);
    const owner = await bearer(0); const outsider = await bearer(3);
    await request(app.getHttpServer()).get(`/v1/contracts/${contract.id}`).set('Authorization', outsider).expect(404);
    await request(app.getHttpServer()).get(`/v1/conversations/${conversationId}/messages`).set('Authorization', outsider).expect(404);
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post(`/v1/conversations/${conversationId}/messages`).set('Authorization', owner).send({ body: 'Welcome to the project.' }),
      request(app.getHttpServer()).post(`/v1/conversations/${conversationId}/messages`).set('Authorization', owner).send({ body: 'Please share a first update.' }),
    ]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(new Set([first.body.sequence, second.body.sequence]).size).toBe(2);
    await request(app.getHttpServer()).post(`/v1/conversations/${conversationId}/messages`).set('Authorization', outsider).send({ body: 'Impersonation attempt' }).expect(404);
    await request(app.getHttpServer()).post(`/v1/conversations/${conversationId}/messages`).set('Authorization', freelancer).send({ body: 'I have started the work.' }).expect(201);
    const page = await request(app.getHttpServer()).get(`/v1/conversations/${conversationId}/messages?limit=2`).set('Authorization', freelancer).expect(200);
    expect(page.body.items).toHaveLength(2); expect(page.body.hasMore).toBe(true);
    expect(BigInt(page.body.items[0].sequence) > BigInt(page.body.items[1].sequence)).toBe(true);
    const older = await request(app.getHttpServer()).get(`/v1/conversations/${conversationId}/messages?limit=2&before=${page.body.nextBefore}`).set('Authorization', freelancer).expect(200);
    expect(older.body.items).toHaveLength(1);
    const beforeRead = await request(app.getHttpServer()).get('/v1/me/conversations').set('Authorization', freelancer).expect(200);
    expect(beforeRead.body.items.find((x: any) => x.id === conversationId).unreadCount).toBe(2);
    await request(app.getHttpServer()).post(`/v1/conversations/${conversationId}/read`).set('Authorization', freelancer).send({ throughSequence: page.body.items[0].sequence }).expect(201);
    const afterRead = await request(app.getHttpServer()).get('/v1/me/conversations').set('Authorization', freelancer).expect(200);
    expect(afterRead.body.items.find((x: any) => x.id === conversationId).unreadCount).toBe(0);
    expect((await db.message.findMany({ where: { conversationId }, orderBy: { sequence: 'asc' } })).map(x => x.sequence)).toEqual([1n, 2n, 3n]);
  });
  it('preserves revisions and completes the contract only after approval', async () => {
    const contract = await db.contract.findUniqueOrThrow({ where: { jobId }, include: { milestones: true, conversation: true } });
    const milestoneId = contract.milestones[0].id;
    const freelancer = await bearer(contract.freelancerUserId === ids[1] ? 1 : 2);
    const owner = await bearer(0);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/complete`).set('Authorization', owner).expect(409);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/submit`).set('Authorization', owner).send({ description: 'The owner cannot submit work on behalf of the freelancer.' }).expect(404);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/submit`).set('Authorization', freelancer).send({ description: 'First implementation of the agreed API deliverable.' }).expect(201);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/submit`).set('Authorization', freelancer).send({ description: 'Duplicate work submission must fail cleanly.' }).expect(409);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/approve`).set('Authorization', freelancer).expect(404);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/request-revision`).set('Authorization', owner).send({ reason: 'Please document the error handling behavior.' }).expect(201);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/cancel`).set('Authorization', owner).send({ reason: 'Cancellation after work submission is unsupported.' }).expect(409);
    await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/submit`).set('Authorization', freelancer).send({ description: 'Revised implementation with documented error handling.' }).expect(201);
    const [approve, revise] = await Promise.all([
      request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/approve`).set('Authorization', owner),
      request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/request-revision`).set('Authorization', owner).send({ reason: 'Concurrent revision request for consistency test.' }),
    ]);
    expect([approve.status, revise.status].sort()).toEqual([201, 409]);
    if (revise.status === 201) {
      await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/submit`).set('Authorization', freelancer).send({ description: 'Final resubmission after the concurrent revision.' }).expect(201);
      await request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/milestones/${milestoneId}/approve`).set('Authorization', owner).expect(201);
    }
    const detail = await request(app.getHttpServer()).get(`/v1/contracts/${contract.id}`).set('Authorization', freelancer).expect(200);
    expect(detail.body.milestones[0].submissions.length).toBeGreaterThanOrEqual(2);
    expect(detail.body.milestones[0].submissions[0].revisionReason).toBeTruthy();
    const [a, b] = await Promise.all([
      request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/complete`).set('Authorization', owner),
      request(app.getHttpServer()).post(`/v1/contracts/${contract.id}/complete`).set('Authorization', owner),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('COMPLETED');
    expect(await db.auditLog.count({ where: { action: 'CONTRACT_COMPLETED', entityId: contract.id } })).toBe(1);
    await request(app.getHttpServer()).post(`/v1/conversations/${contract.conversation!.id}/messages`).set('Authorization', freelancer).send({ body: 'No post-completion send.' }).expect(409);
    await request(app.getHttpServer()).get(`/v1/conversations/${contract.conversation!.id}/messages`).set('Authorization', freelancer).expect(200);
  });
  it('allows only pre-submission cancellation and isolates notifications', async () => {
    const owner = await bearer(0); const freelancer = await bearer(2); const outsider = await bearer(3);
    const job = await request(app.getHttpServer()).post('/v1/jobs').set('Authorization', owner).send({ organizationId: orgId, title: 'Second API project', description: 'A separate project for conservative contract cancellation.', budgetPaise: 150000, skills: ['TypeScript'] }).expect(201);
    await request(app.getHttpServer()).post(`/v1/jobs/${job.body.id}/publish`).set('Authorization', owner).expect(201);
    const proposal = await request(app.getHttpServer()).post(`/v1/jobs/${job.body.id}/proposals`).set('Authorization', freelancer).send({ coverLetter: 'I can build this second project and deliver it carefully.', bidPaise: 140000, deliveryDays: 7 }).expect(201);
    const hired = await request(app.getHttpServer()).post(`/v1/proposals/${proposal.body.id}/hire`).set('Authorization', owner).set('Idempotency-Key', `cancel-test-${randomUUID()}`).expect(201);
    const contractId = hired.body.id;
    expect((await db.conversation.count({ where: { contractId } }))).toBe(1);
    await request(app.getHttpServer()).post(`/v1/contracts/${contractId}/cancel`).set('Authorization', freelancer).send({ reason: 'Freelancer cannot cancel as organization owner.' }).expect(404);
    await request(app.getHttpServer()).post(`/v1/contracts/${contractId}/cancel`).set('Authorization', owner).send({ reason: 'Mutual cancellation before any submitted work.' }).expect(201);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.body.id } })).status).toBe('CANCELLED');
    expect((await db.contractMilestone.findFirstOrThrow({ where: { contractId } })).status).toBe('CANCELLED');
    const notifications = await request(app.getHttpServer()).get('/v1/me/notifications').set('Authorization', freelancer).expect(200);
    expect(notifications.body.items.some((x: any) => x.type === 'CONTRACT_CANCELLED')).toBe(true);
    const item = notifications.body.items[0];
    await request(app.getHttpServer()).post(`/v1/me/notifications/${item.id}/read`).set('Authorization', outsider).expect(404);
    const unread = await request(app.getHttpServer()).get('/v1/me/notifications/unread-count').set('Authorization', freelancer).expect(200);
    expect(unread.body.count).toBeGreaterThan(0);
    await request(app.getHttpServer()).post(`/v1/me/notifications/${item.id}/read`).set('Authorization', freelancer).expect(201);
    await request(app.getHttpServer()).post('/v1/me/notifications/read-all').set('Authorization', freelancer).expect(201);
    expect((await request(app.getHttpServer()).get('/v1/me/notifications/unread-count').set('Authorization', freelancer).expect(200)).body.count).toBe(0);
  });
});

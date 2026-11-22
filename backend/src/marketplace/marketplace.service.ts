import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateJobDto, EditJobDto, FreelancerQuery, JobQuery, JobSort, SubmitProposalDto } from './dto';
import { notifyOwners, notifyUser } from '../notifications/notification-writer';

const txOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 };
const jobInclude = { skills: { include: { skill: true } }, organization: { select: { id: true, name: true, slug: true } } } as const;
const proposalInclude = { milestones: { orderBy: { sequence: 'asc' as const } }, job: { select: { title: true, status: true } } } as const;
const normalizeSkill = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
const money = (amount: bigint) => amount.toString();

@Injectable()
export class MarketplaceService {
  constructor(private readonly db: PrismaService) {}

  private skillNames(input: string[]): string[] {
    const names = input.map(normalizeSkill);
    if (names.some(x => x.length < 2 || x.length > 80 || !/^[\p{L}\p{N} +.#-]+$/u.test(x)) || new Set(names).size !== names.length) {
      throw new BadRequestException('Invalid or duplicate skill');
    }
    return names;
  }
  private future(deadline?: string): Date | undefined {
    if (!deadline) return undefined;
    const value = new Date(deadline);
    if (value <= new Date()) throw new BadRequestException('Deadline must be in the future');
    return value;
  }
  private async role(userId: string, role: UserRole) {
    const exists = await this.db.userRoleAssignment.findUnique({ where: { userId_role: { userId, role } } });
    if (!exists) throw new ForbiddenException(`${role} role required`);
  }
  private async member(userId: string, organizationId: string, owner = false) {
    await this.role(userId, UserRole.CLIENT);
    const member = await this.db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!member || (owner && member.membershipRole !== 'OWNER')) throw new NotFoundException('Organization not found');
  }
  private jobView(job: any) {
    return { id: job.id, organization: job.organization, title: job.title, description: job.description,
      budgetPaise: money(job.budgetPaise), status: job.status, deadline: job.deadline,
      publishedAt: job.publishedAt, createdAt: job.createdAt,
      skills: job.skills.map((x: any) => x.skill.name) };
  }
  private proposalView(proposal: any) {
    return { id: proposal.id, jobId: proposal.jobId, jobTitle: proposal.job.title, jobStatus: proposal.job.status, freelancerUserId: proposal.freelancerUserId,
      coverLetter: proposal.coverLetter, bidPaise: money(proposal.bidPaise), deliveryDays: proposal.deliveryDays,
      status: proposal.status, createdAt: proposal.createdAt,
      milestones: proposal.milestones.map((x: any) => ({ id: x.id, sequence: x.sequence, title: x.title, amountPaise: money(x.amountPaise) })) };
  }
  private contractView(contract: any) {
    return { id: contract.id, jobId: contract.jobId, proposalId: contract.proposalId, organizationId: contract.organizationId,
      freelancerUserId: contract.freelancerUserId, agreedPaise: money(contract.agreedPaise), status: contract.status,
      createdAt: contract.createdAt, milestones: contract.milestones.map((x: any) => ({ id: x.id, sequence: x.sequence, title: x.title, amountPaise: money(x.amountPaise), status: x.status })) };
  }
  private async attachSkills(tx: Prisma.TransactionClient, names: string[], jobId?: string, profileId?: string) {
    for (const name of names) {
      const skill = await tx.skill.upsert({ where: { name }, create: { name }, update: {} });
      if (jobId) await tx.jobSkill.create({ data: { jobId, skillId: skill.id } });
      if (profileId) await tx.freelancerSkill.create({ data: { profileId, skillId: skill.id } });
    }
  }

  async listJobs(query: JobQuery) {
    if (query.minBudgetPaise && query.maxBudgetPaise && query.minBudgetPaise > query.maxBudgetPaise) throw new BadRequestException('Invalid budget range');
    const where: Prisma.JobWhereInput = { status: 'OPEN',
      ...(query.q && { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] }),
      ...(query.skill && { skills: { some: { skill: { name: normalizeSkill(query.skill) } } } }),
      ...((query.minBudgetPaise || query.maxBudgetPaise) && { budgetPaise: { gte: query.minBudgetPaise && BigInt(query.minBudgetPaise), lte: query.maxBudgetPaise && BigInt(query.maxBudgetPaise) } }) };
    const orderBy: Prisma.JobOrderByWithRelationInput[] = query.sort === JobSort.BUDGET_ASC ? [{ budgetPaise: 'asc' }, { id: 'asc' }] :
      query.sort === JobSort.BUDGET_DESC ? [{ budgetPaise: 'desc' }, { id: 'asc' }] : [{ publishedAt: 'desc' }, { id: 'desc' }];
    const [items, total] = await this.db.$transaction([
      this.db.job.findMany({ where, include: jobInclude, orderBy, skip: query.offset, take: query.limit }), this.db.job.count({ where })]);
    return { items: items.map(x => this.jobView(x)), total, limit: query.limit, offset: query.offset };
  }
  async publicJob(id: string) {
    const job = await this.db.job.findFirst({ where: { id, status: 'OPEN' }, include: jobInclude });
    if (!job) throw new NotFoundException('Job not found');
    return this.jobView(job);
  }
  async listFreelancers(query: FreelancerQuery) {
    const where: Prisma.FreelancerProfileWhereInput = { user: { status: 'ACTIVE', displayName: { not: null }, roles: { some: { role: 'FREELANCER' } } },
      headline: { not: null },
      ...(query.q && { OR: [{ headline: { contains: query.q, mode: 'insensitive' } }, { bio: { contains: query.q, mode: 'insensitive' } }, { user: { displayName: { contains: query.q, mode: 'insensitive' } } }] }),
      ...(query.skill && { skills: { some: { skill: { name: normalizeSkill(query.skill) } } } }),
      ...(query.city && { locationCity: { equals: query.city, mode: 'insensitive' } }),
      ...(query.state && { locationState: { equals: query.state, mode: 'insensitive' } }) };
    const [items, total] = await this.db.$transaction([
      this.db.freelancerProfile.findMany({ where, include: { user: { select: { displayName: true } }, skills: { include: { skill: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: query.offset, take: query.limit }),
      this.db.freelancerProfile.count({ where })]);
    return { items: items.map(x => this.freelancerView(x)), total, limit: query.limit, offset: query.offset };
  }
  private freelancerView(profile: any) {
    return { id: profile.id, displayName: profile.user.displayName, headline: profile.headline, bio: profile.bio,
      locationCity: profile.locationCity, locationState: profile.locationState, countryCode: profile.countryCode,
      skills: profile.skills.map((x: any) => x.skill.name) };
  }
  async publicFreelancer(id: string) {
    const profile = await this.db.freelancerProfile.findFirst({ where: { id, headline: { not: null }, user: { status: 'ACTIVE', displayName: { not: null }, roles: { some: { role: 'FREELANCER' } } } },
      include: { user: { select: { displayName: true } }, skills: { include: { skill: true } } } });
    if (!profile) throw new NotFoundException('Freelancer not found');
    return this.freelancerView(profile);
  }
  async setMySkills(userId: string, input: string[]) {
    await this.role(userId, UserRole.FREELANCER);
    const names = this.skillNames(input);
    const profile = await this.db.freelancerProfile.findUniqueOrThrow({ where: { userId } });
    await this.db.$transaction(async tx => {
      await tx.freelancerSkill.deleteMany({ where: { profileId: profile.id } });
      await this.attachSkills(tx, names, undefined, profile.id);
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'FREELANCER_SKILLS_UPDATED', entityType: 'freelancer_profile', entityId: profile.id, metadata: { skills: names } } });
    }, txOptions);
    return { skills: names };
  }
  async createJob(userId: string, input: CreateJobDto) {
    await this.member(userId, input.organizationId, true);
    if (input.title.trim().length < 5 || input.description.trim().length < 30) throw new BadRequestException('Title or description too short');
    const names = this.skillNames(input.skills);
    const deadline = this.future(input.deadline);
    const job = await this.db.$transaction(async tx => {
      const created = await tx.job.create({ data: { organizationId: input.organizationId, createdByUserId: userId,
        title: input.title.trim(), description: input.description.trim(), budgetPaise: BigInt(input.budgetPaise), deadline } });
      await this.attachSkills(tx, names, created.id);
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'JOB_CREATED', entityType: 'job', entityId: created.id, metadata: {} } });
      return tx.job.findUniqueOrThrow({ where: { id: created.id }, include: jobInclude });
    }, txOptions);
    return this.jobView(job);
  }
  async editJob(userId: string, id: string, input: EditJobDto) {
    const existing = await this.db.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    await this.member(userId, existing.organizationId, true);
    if (input.title !== undefined && input.title.trim().length < 5 || input.description !== undefined && input.description.trim().length < 30) throw new BadRequestException('Title or description too short');
    const names = input.skills && this.skillNames(input.skills);
    const deadline = this.future(input.deadline);
    return this.db.$transaction(async tx => {
      const changed = await tx.job.updateMany({ where: { id, status: 'DRAFT' }, data: { title: input.title?.trim(), description: input.description?.trim(),
        budgetPaise: input.budgetPaise && BigInt(input.budgetPaise), deadline } });
      if (!changed.count) throw new ConflictException('Only draft jobs can be edited');
      if (names) { await tx.jobSkill.deleteMany({ where: { jobId: id } }); await this.attachSkills(tx, names, id); }
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'JOB_UPDATED', entityType: 'job', entityId: id, metadata: { fields: Object.keys(input) } } });
      return this.jobView(await tx.job.findUniqueOrThrow({ where: { id }, include: jobInclude }));
    }, txOptions);
  }
  async publishJob(userId: string, id: string) {
    const job = await this.db.job.findUnique({ where: { id }, include: { skills: true } });
    if (!job) throw new NotFoundException('Job not found');
    await this.member(userId, job.organizationId, true);
    if (!job.skills.length || job.deadline && job.deadline <= new Date()) throw new BadRequestException('Job requires skills and a future deadline if set');
    return this.db.$transaction(async tx => {
      const changed = await tx.job.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'OPEN', publishedAt: new Date() } });
      if (!changed.count) throw new ConflictException('Job is not a draft');
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'JOB_PUBLISHED', entityType: 'job', entityId: id, metadata: {} } });
      return this.jobView(await tx.job.findUniqueOrThrow({ where: { id }, include: jobInclude }));
    }, txOptions);
  }
  async myJobs(userId: string, limit: number, offset: number) {
    await this.role(userId, UserRole.CLIENT);
    const where: Prisma.JobWhereInput = { organization: { members: { some: { userId } } } };
    const [items, total] = await this.db.$transaction([this.db.job.findMany({ where, include: jobInclude, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }), this.db.job.count({ where })]);
    return { items: items.map(x => this.jobView(x)), total, limit, offset };
  }
  async myJob(userId: string, id: string) {
    const job = await this.db.job.findUnique({ where: { id }, include: jobInclude });
    if (!job) throw new NotFoundException('Job not found');
    await this.member(userId, job.organizationId, true);
    return this.jobView(job);
  }
  async submitProposal(userId: string, jobId: string, input: SubmitProposalDto) {
    await this.role(userId, UserRole.FREELANCER);
    if (input.coverLetter.trim().length < 30 || input.milestones?.some(x => x.title.trim().length < 3)) throw new BadRequestException('Cover letter or milestone title too short');
    if (input.milestones?.length && input.milestones.reduce((sum, x) => sum + x.amountPaise, 0) !== input.bidPaise) throw new BadRequestException('Milestone sum must equal bid');
    const job = await this.db.job.findUnique({ where: { id: jobId }, include: { organization: { include: { members: { where: { userId } } } } } });
    if (!job || job.status !== 'OPEN') throw new NotFoundException('Open job not found');
    if (job.organization.members.length) throw new ForbiddenException('Cannot propose to own organization');
    try {
      const proposal = await this.db.$transaction(async tx => {
        const open = await tx.job.findUnique({ where: { id: jobId } });
        if (open?.status !== 'OPEN') throw new ConflictException('Job is no longer open');
        const created = await tx.proposal.create({ data: { jobId, freelancerUserId: userId, coverLetter: input.coverLetter.trim(), bidPaise: BigInt(input.bidPaise), deliveryDays: input.deliveryDays,
          milestones: { create: (input.milestones || []).map((m, i) => ({ sequence: i + 1, title: m.title.trim(), amountPaise: BigInt(m.amountPaise) })) } } });
        await tx.auditLog.create({ data: { actorUserId: userId, action: 'PROPOSAL_SUBMITTED', entityType: 'proposal', entityId: created.id, metadata: { jobId } } });
        await notifyOwners(tx, job.organizationId, 'PROPOSAL_RECEIVED', 'proposal', created.id, { jobId });
        return tx.proposal.findUniqueOrThrow({ where: { id: created.id }, include: proposalInclude });
      }, txOptions);
      return this.proposalView(proposal);
    } catch (error) { if (this.prismaConflict(error)) throw new ConflictException('Proposal already exists or job changed'); throw error; }
  }
  async myProposals(userId: string, limit: number, offset: number) {
    await this.role(userId, UserRole.FREELANCER);
    const where = { freelancerUserId: userId };
    const [items, total] = await this.db.$transaction([this.db.proposal.findMany({ where, include: proposalInclude, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }), this.db.proposal.count({ where })]);
    return { items: items.map(x => this.proposalView(x)), total, limit, offset };
  }
  async jobProposals(userId: string, jobId: string, limit: number, offset: number) {
    const job = await this.db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    await this.member(userId, job.organizationId);
    const where = { jobId };
    const [items, total] = await this.db.$transaction([this.db.proposal.findMany({ where, include: proposalInclude, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }), this.db.proposal.count({ where })]);
    return { items: items.map(x => this.proposalView(x)), total, limit, offset };
  }
  async transitionProposal(userId: string, id: string, target: 'SHORTLISTED' | 'REJECTED') {
    const proposal = await this.db.proposal.findUnique({ where: { id }, include: { job: true } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    await this.member(userId, proposal.job.organizationId, true);
    return this.db.$transaction(async tx => {
      const changed = await tx.proposal.updateMany({ where: { id, status: target === 'SHORTLISTED' ? 'SUBMITTED' : { in: ['SUBMITTED', 'SHORTLISTED'] }, job: { status: 'OPEN' } }, data: { status: target } });
      if (!changed.count) throw new ConflictException('Invalid proposal transition');
      await tx.auditLog.create({ data: { actorUserId: userId, action: `PROPOSAL_${target}`, entityType: 'proposal', entityId: id, metadata: {} } });
      await notifyUser(tx, proposal.freelancerUserId, target === 'SHORTLISTED' ? 'PROPOSAL_SHORTLISTED' : 'PROPOSAL_REJECTED', 'proposal', id, { jobId: proposal.jobId });
      return this.proposalView(await tx.proposal.findUniqueOrThrow({ where: { id }, include: proposalInclude }));
    }, txOptions);
  }
  private prismaConflict(error: unknown): boolean { return error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code); }
  async hire(userId: string, proposalId: string, key: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new BadRequestException('Valid Idempotency-Key required');
    await this.role(userId, UserRole.CLIENT);
    const proposal = await this.db.proposal.findUnique({ where: { id: proposalId }, include: { job: true } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    await this.member(userId, proposal.job.organizationId, true);
    if (proposal.freelancerUserId === userId) throw new ForbiddenException('Cannot hire yourself');
    const prior = await this.db.hireRequest.findUnique({ where: { actorUserId_key: { actorUserId: userId, key } }, include: { contract: { include: { milestones: { orderBy: { sequence: 'asc' } } } } } });
    if (prior) { if (prior.proposalId !== proposalId) throw new ConflictException('Idempotency key already used for another proposal'); return this.contractView(prior.contract); }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const contract = await this.db.$transaction(async tx => {
          const replay = await tx.hireRequest.findUnique({ where: { actorUserId_key: { actorUserId: userId, key } }, include: { contract: { include: { milestones: { orderBy: { sequence: 'asc' } } } } } });
          if (replay) { if (replay.proposalId !== proposalId) throw new ConflictException('Idempotency key already used for another proposal'); return replay.contract; }
          const selected = await tx.proposal.findUniqueOrThrow({ where: { id: proposalId }, include: { milestones: { orderBy: { sequence: 'asc' } } } });
          if (!['SUBMITTED', 'SHORTLISTED'].includes(selected.status)) throw new ConflictException('Proposal cannot be hired');
          const changed = await tx.job.updateMany({ where: { id: selected.jobId, status: 'OPEN' }, data: { status: 'HIRED' } });
          if (!changed.count) throw new ConflictException('Job is no longer open');
          await tx.proposal.update({ where: { id: proposalId }, data: { status: 'HIRED' } });
          const created = await tx.contract.create({ data: { jobId: selected.jobId, proposalId, organizationId: proposal.job.organizationId,
            freelancerUserId: selected.freelancerUserId, agreedPaise: selected.bidPaise,
            milestones: { create: selected.milestones.length ? selected.milestones.map(m => ({ sequence: m.sequence, title: m.title, amountPaise: m.amountPaise })) : [{ sequence: 1, title: 'Project delivery', amountPaise: selected.bidPaise }] } }, include: { milestones: { orderBy: { sequence: 'asc' } } } });
          await tx.conversation.create({ data: { contractId: created.id, organizationId: proposal.job.organizationId, freelancerUserId: selected.freelancerUserId } });
          await tx.hireRequest.create({ data: { actorUserId: userId, key, proposalId, contractId: created.id } });
          await tx.auditLog.create({ data: { actorUserId: userId, action: 'PROPOSAL_HIRED', entityType: 'contract', entityId: created.id, metadata: { jobId: selected.jobId, proposalId } } });
          await notifyUser(tx, selected.freelancerUserId, 'FREELANCER_HIRED', 'contract', created.id, { jobId: selected.jobId });
          await notifyOwners(tx, proposal.job.organizationId, 'CONTRACT_CREATED', 'contract', created.id, { jobId: selected.jobId });
          return created;
        }, txOptions);
        return this.contractView(contract);
      } catch (error) {
        if (this.prismaConflict(error)) {
          const replay = await this.db.hireRequest.findUnique({ where: { actorUserId_key: { actorUserId: userId, key } }, include: { contract: { include: { milestones: { orderBy: { sequence: 'asc' } } } } } });
          if (replay) { if (replay.proposalId !== proposalId) throw new ConflictException('Idempotency key already used for another proposal'); return this.contractView(replay.contract); }
          if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue;
          throw new ConflictException('Job was hired by another request');
        }
        throw error;
      }
    }
    throw new ConflictException('Concurrent hire conflict');
  }
}

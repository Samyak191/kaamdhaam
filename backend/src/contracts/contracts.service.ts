import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { notifyOwners, notifyUser } from '../notifications/notification-writer';
import { CancelContractDto, RevisionDto, SubmitMilestoneDto } from './dto';

const options = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 };
const detailInclude = { job: { select: { title: true } }, organization: { select: { id: true, name: true } },
  conversation: { select: { id: true } }, milestones: { orderBy: { sequence: 'asc' as const },
    include: { submissions: { orderBy: { revisionNumber: 'asc' as const } } } } } as const;

@Injectable()
export class ContractsService {
  constructor(private readonly db: PrismaService) {}

  private view(contract: any) {
    return { id: contract.id, jobId: contract.jobId, jobTitle: contract.job.title,
      organization: contract.organization, freelancerUserId: contract.freelancerUserId,
      agreedPaise: contract.agreedPaise.toString(), status: contract.status,
      createdAt: contract.createdAt, completedAt: contract.completedAt, cancelledAt: contract.cancelledAt, cancellationReason: contract.cancellationReason,
      conversationId: contract.conversation?.id,
      milestones: contract.milestones.map((m: any) => ({ id: m.id, sequence: m.sequence, title: m.title,
        amountPaise: m.amountPaise.toString(), status: m.status, revisionNumber: m.revisionNumber,
        submittedAt: m.submittedAt, approvedAt: m.approvedAt,
        submissions: m.submissions.map((s: any) => ({ id: s.id, revisionNumber: s.revisionNumber,
          description: s.description, deliverableUrl: s.deliverableUrl, submittedAt: s.submittedAt,
          revisionReason: s.revisionReason, revisionRequestedAt: s.revisionRequestedAt })) })) };
  }
  private async contract(userId: string, id: string, owner = false) {
    const contract = await this.db.contract.findUnique({ where: { id }, include: detailInclude });
    if (!contract) throw new NotFoundException('Contract not found');
    if (owner) {
      const member = await this.db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: contract.organizationId, userId } } });
      const role = await this.db.userRoleAssignment.findUnique({ where: { userId_role: { userId, role: 'CLIENT' } } });
      if (member?.membershipRole !== 'OWNER' || !role) throw new NotFoundException('Contract not found');
    } else if (contract.freelancerUserId !== userId) {
      const member = await this.db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: contract.organizationId, userId } } });
      if (!member) throw new NotFoundException('Contract not found');
    }
    return contract;
  }
  async myContracts(userId: string, limit: number, offset: number) {
    const where: Prisma.ContractWhereInput = { OR: [{ freelancerUserId: userId }, { organization: { members: { some: { userId } } } }] };
    const [items, total] = await this.db.$transaction([
      this.db.contract.findMany({ where, include: detailInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit, skip: offset }),
      this.db.contract.count({ where })]);
    return { items: items.map(x => this.view(x)), total, limit, offset };
  }
  async get(userId: string, id: string) { return this.view(await this.contract(userId, id)); }

  private async retry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await work(); } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          if (attempt < 2) continue;
          throw new ConflictException('Concurrent contract change');
        }
        throw error;
      }
    }
    throw new ConflictException('Concurrent contract change');
  }
  async submit(userId: string, contractId: string, milestoneId: string, input: SubmitMilestoneDto) {
    const contract = await this.contract(userId, contractId);
    if (contract.freelancerUserId !== userId) throw new NotFoundException('Milestone not found');
    if (input.description.trim().length < 20) throw new BadRequestException('Description too short');
    const milestone = contract.milestones.find(x => x.id === milestoneId);
    if (!milestone) throw new NotFoundException('Milestone not found');
    return this.retry(() => this.db.$transaction(async tx => {
      const active = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
      const current = await tx.contractMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
      if (active.status !== 'ACTIVE' || !['PLANNED', 'REVISION_REQUESTED'].includes(current.status)) throw new ConflictException('Milestone cannot be submitted');
      const nextRevision = current.revisionNumber + 1;
      const changed = await tx.contractMilestone.updateMany({ where: { id: milestoneId, contractId, status: current.status, revisionNumber: current.revisionNumber },
        data: { status: 'SUBMITTED', revisionNumber: nextRevision, submittedAt: new Date() } });
      if (!changed.count) throw new ConflictException('Milestone changed');
      const submission = await tx.milestoneSubmission.create({ data: { milestoneId, revisionNumber: nextRevision,
        description: input.description.trim(), deliverableUrl: input.deliverableUrl } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'MILESTONE_SUBMITTED', entityType: 'contract_milestone', entityId: milestoneId,
        metadata: { contractId, revisionNumber: nextRevision } } });
      await notifyOwners(tx, active.organizationId, 'MILESTONE_SUBMITTED', 'contract_milestone', milestoneId,
        { contractId, revisionNumber: nextRevision }, `MILESTONE_SUBMITTED:${submission.id}`);
      return this.view(await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: detailInclude }));
    }, options));
  }
  async approve(userId: string, contractId: string, milestoneId: string) {
    const contract = await this.contract(userId, contractId, true);
    if (!contract.milestones.some(x => x.id === milestoneId)) throw new NotFoundException('Milestone not found');
    return this.retry(() => this.db.$transaction(async tx => {
      const active = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
      if (active.status !== 'ACTIVE') throw new ConflictException('Contract is not active');
      const changed = await tx.contractMilestone.updateMany({ where: { id: milestoneId, contractId, status: 'SUBMITTED' }, data: { status: 'APPROVED', approvedAt: new Date() } });
      if (!changed.count) throw new ConflictException('Milestone is not submitted');
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'MILESTONE_APPROVED', entityType: 'contract_milestone', entityId: milestoneId, metadata: { contractId } } });
      await notifyUser(tx, active.freelancerUserId, 'MILESTONE_APPROVED', 'contract_milestone', milestoneId, { contractId });
      return this.view(await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: detailInclude }));
    }, options));
  }
  async requestRevision(userId: string, contractId: string, milestoneId: string, input: RevisionDto) {
    const contract = await this.contract(userId, contractId, true);
    if (!contract.milestones.some(x => x.id === milestoneId)) throw new NotFoundException('Milestone not found');
    if (input.reason.trim().length < 10) throw new BadRequestException('Revision reason too short');
    return this.retry(() => this.db.$transaction(async tx => {
      const active = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
      const current = await tx.contractMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
      if (active.status !== 'ACTIVE' || current.status !== 'SUBMITTED') throw new ConflictException('Milestone is not submitted');
      const changed = await tx.contractMilestone.updateMany({ where: { id: milestoneId, contractId, status: 'SUBMITTED', revisionNumber: current.revisionNumber }, data: { status: 'REVISION_REQUESTED' } });
      if (!changed.count) throw new ConflictException('Milestone changed');
      await tx.milestoneSubmission.update({ where: { milestoneId_revisionNumber: { milestoneId, revisionNumber: current.revisionNumber } },
        data: { revisionReason: input.reason.trim(), revisionRequestedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'MILESTONE_REVISION_REQUESTED', entityType: 'contract_milestone', entityId: milestoneId,
        metadata: { contractId, revisionNumber: current.revisionNumber } } });
      await notifyUser(tx, active.freelancerUserId, 'REVISION_REQUESTED', 'contract_milestone', milestoneId,
        { contractId, revisionNumber: current.revisionNumber }, `REVISION_REQUESTED:${milestoneId}:${current.revisionNumber}`);
      return this.view(await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: detailInclude }));
    }, options));
  }
  async complete(userId: string, id: string) {
    await this.contract(userId, id, true);
    return this.retry(() => this.db.$transaction(async tx => {
      const contract = await tx.contract.findUniqueOrThrow({ where: { id }, include: { milestones: true } });
      if (contract.status === 'COMPLETED') return this.view(await tx.contract.findUniqueOrThrow({ where: { id }, include: detailInclude }));
      if (contract.status !== 'ACTIVE' || !contract.milestones.length || contract.milestones.some(m => m.status !== 'APPROVED')) throw new ConflictException('All milestones must be approved');
      const changed = await tx.contract.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt: new Date() } });
      const jobChanged = await tx.job.updateMany({ where: { id: contract.jobId, status: 'HIRED' }, data: { status: 'COMPLETED' } });
      if (!changed.count || !jobChanged.count) throw new ConflictException('Contract or job changed');
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'CONTRACT_COMPLETED', entityType: 'contract', entityId: id, metadata: { jobId: contract.jobId } } });
      await notifyUser(tx, contract.freelancerUserId, 'CONTRACT_COMPLETED', 'contract', id, { jobId: contract.jobId });
      return this.view(await tx.contract.findUniqueOrThrow({ where: { id }, include: detailInclude }));
    }, options));
  }
  async cancel(userId: string, id: string, input: CancelContractDto) {
    await this.contract(userId, id, true);
    if (input.reason.trim().length < 10) throw new BadRequestException('Cancellation reason too short');
    return this.retry(() => this.db.$transaction(async tx => {
      const contract = await tx.contract.findUniqueOrThrow({ where: { id }, include: { milestones: true } });
      if (contract.status === 'CANCELLED') return this.view(await tx.contract.findUniqueOrThrow({ where: { id }, include: detailInclude }));
      if (contract.status !== 'ACTIVE' || contract.milestones.some(m => m.status !== 'PLANNED')) throw new ConflictException('Cancellation after work submission is unsupported');
      const changed = await tx.contract.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: input.reason.trim() } });
      const jobChanged = await tx.job.updateMany({ where: { id: contract.jobId, status: 'HIRED' }, data: { status: 'CANCELLED' } });
      if (!changed.count || !jobChanged.count) throw new ConflictException('Contract or job changed');
      await tx.contractMilestone.updateMany({ where: { contractId: id, status: 'PLANNED' }, data: { status: 'CANCELLED' } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'CONTRACT_CANCELLED', entityType: 'contract', entityId: id, metadata: { jobId: contract.jobId } } });
      await notifyUser(tx, contract.freelancerUserId, 'CONTRACT_CANCELLED', 'contract', id, { jobId: contract.jobId });
      return this.view(await tx.contract.findUniqueOrThrow({ where: { id }, include: detailInclude }));
    }, options));
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { notifyOwners, notifyUser } from '../notifications/notification-writer';
import { MessageQuery } from './dto';

const options = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 };

@Injectable()
export class MessagingService {
  constructor(private readonly db: PrismaService) {}
  private async authorized(userId: string, id: string) {
    const conversation = await this.db.conversation.findUnique({ where: { id }, include: { contract: { select: { status: true } } } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.freelancerUserId !== userId) {
      const member = await this.db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: conversation.organizationId, userId } } });
      const role = await this.db.userRoleAssignment.findUnique({ where: { userId_role: { userId, role: 'CLIENT' } } });
      if (member?.membershipRole !== 'OWNER' || !role) throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }
  private messageView(message: any) {
    return { id: message.id, conversationId: message.conversationId, sequence: message.sequence.toString(), senderUserId: message.senderUserId,
      body: message.body, createdAt: message.createdAt };
  }
  async list(userId: string, limit: number, offset: number) {
    const where: Prisma.ConversationWhereInput = { OR: [{ freelancerUserId: userId }, { organization: { members: { some: { userId, membershipRole: 'OWNER', user: { roles: { some: { role: 'CLIENT' } } } } } } }] };
    const [items, total] = await this.db.$transaction([
      this.db.conversation.findMany({ where, include: { contract: { select: { status: true, job: { select: { title: true } } } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: limit, skip: offset }),
      this.db.conversation.count({ where })]);
    const ids = items.map(x => x.id);
    if (!ids.length) return { items: [], total, limit, offset };
    const reads = await this.db.conversationRead.findMany({ where: { userId, conversationId: { in: ids } }, select: { conversationId: true, lastReadSequence: true } });
    const readMap = new Map(reads.map(x => [x.conversationId, x.lastReadSequence]));
    const latest = items.filter(x => x.lastSequence > 0n);
    const lastMessages = latest.length ? await this.db.message.findMany({ where: { OR: latest.map(x => ({ conversationId: x.id, sequence: x.lastSequence })) }, select: { conversationId: true, body: true, createdAt: true, senderUserId: true } }) : [];
    const lastMap = new Map(lastMessages.map(x => [x.conversationId, x]));
    const counts = await this.db.$queryRaw<Array<{ conversation_id: string; count: number }>>(Prisma.sql`
      SELECT m.conversation_id, count(*)::integer AS count FROM messages m
      LEFT JOIN conversation_reads r ON r.conversation_id = m.conversation_id AND r.user_id = ${userId}::uuid
      WHERE m.conversation_id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
        AND m.sequence > COALESCE(r.last_read_sequence, 0) AND m.sender_user_id <> ${userId}::uuid
      GROUP BY m.conversation_id`);
    const countMap = new Map(counts.map(x => [x.conversation_id, x.count]));
    return { items: items.map(x => ({ id: x.id, contractId: x.contractId, jobTitle: x.contract.job.title,
      contractStatus: x.contract.status, freelancerUserId: x.freelancerUserId, organizationId: x.organizationId,
      lastSequence: x.lastSequence.toString(), lastReadSequence: (readMap.get(x.id) || 0n).toString(),
      unreadCount: countMap.get(x.id) || 0, lastMessage: lastMap.get(x.id) || null, updatedAt: x.updatedAt })), total, limit, offset };
  }
  async messages(userId: string, id: string, query: MessageQuery) {
    await this.authorized(userId, id);
    const before = query.before && BigInt(query.before);
    const items = await this.db.message.findMany({ where: { conversationId: id, ...(before && { sequence: { lt: before } }) },
      orderBy: { sequence: 'desc' }, take: query.limit + 1 });
    const hasMore = items.length > query.limit;
    const page = items.slice(0, query.limit);
    return { items: page.map(x => this.messageView(x)), nextBefore: hasMore ? page.at(-1)?.sequence.toString() : null, hasMore };
  }
  async send(userId: string, id: string, body: string) {
    const conversation = await this.authorized(userId, id);
    const clean = body.trim();
    if (!clean || clean.length > 4000) throw new BadRequestException('Message must contain 1–4000 characters');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(async tx => {
          const contract = await tx.contract.findUniqueOrThrow({ where: { id: conversation.contractId } });
          if (contract.status !== 'ACTIVE') throw new ConflictException('Conversation is read-only after contract closure');
          const next = await tx.conversation.update({ where: { id }, data: { lastSequence: { increment: 1 } } });
          const message = await tx.message.create({ data: { conversationId: id, sequence: next.lastSequence, senderUserId: userId, body: clean } });
          if (userId === conversation.freelancerUserId) await notifyOwners(tx, conversation.organizationId, 'MESSAGE_RECEIVED', 'conversation', id,
            { contractId: conversation.contractId }, `MESSAGE_RECEIVED:${message.id}`);
          else await notifyUser(tx, conversation.freelancerUserId, 'MESSAGE_RECEIVED', 'conversation', id,
            { contractId: conversation.contractId }, `MESSAGE_RECEIVED:${message.id}`);
          return this.messageView(message);
        }, options);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          if (attempt < 2) continue;
          throw new ConflictException('Concurrent message change');
        }
        throw error;
      }
    }
    throw new ConflictException('Concurrent message change');
  }
  async markRead(userId: string, id: string, throughSequence: string) {
    const conversation = await this.authorized(userId, id);
    const sequence = BigInt(throughSequence);
    if (sequence > conversation.lastSequence) throw new BadRequestException('Read sequence exceeds conversation history');
    await this.db.conversationRead.createMany({ data: [{ conversationId: id, userId, lastReadSequence: 0n }], skipDuplicates: true });
    await this.db.conversationRead.updateMany({ where: { conversationId: id, userId, lastReadSequence: { lt: sequence } }, data: { lastReadSequence: sequence } });
    const current = await this.db.conversationRead.findUniqueOrThrow({ where: { conversationId_userId: { conversationId: id, userId } } });
    return { conversationId: id, lastReadSequence: current.lastReadSequence.toString() };
  }
}

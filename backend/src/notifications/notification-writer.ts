import { NotificationType, Prisma } from '../generated/prisma/client';

type Meta = Record<string, string | number | boolean>;

export async function notifyUser(tx: Prisma.TransactionClient, recipientUserId: string, type: NotificationType,
  relatedEntityType: string, relatedEntityId: string, metadata: Meta = {}, eventKey = `${type}:${relatedEntityId}`) {
  await tx.notification.createMany({ data: [{ recipientUserId, type, relatedEntityType, relatedEntityId,
    metadata, dedupeKey: `${eventKey}:${recipientUserId}` }], skipDuplicates: true });
}

export async function notifyOwners(tx: Prisma.TransactionClient, organizationId: string, type: NotificationType,
  relatedEntityType: string, relatedEntityId: string, metadata: Meta = {}, eventKey = `${type}:${relatedEntityId}`) {
  const owners = await tx.organizationMember.findMany({ where: { organizationId, membershipRole: 'OWNER' }, select: { userId: true } });
  await tx.notification.createMany({ data: owners.map(owner => ({ recipientUserId: owner.userId, type,
    relatedEntityType, relatedEntityId, metadata, dedupeKey: `${eventKey}:${owner.userId}` })), skipDuplicates: true });
}

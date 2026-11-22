import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: PrismaService) {}
  async list(userId: string, limit: number, offset: number) {
    const where = { recipientUserId: userId };
    const [items, total] = await this.db.$transaction([
      this.db.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit, skip: offset }),
      this.db.notification.count({ where })]);
    return { items, total, limit, offset };
  }
  async unreadCount(userId: string) { return { count: await this.db.notification.count({ where: { recipientUserId: userId, readAt: null } }) }; }
  async read(userId: string, id: string) {
    const notification = await this.db.notification.findFirst({ where: { id, recipientUserId: userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!notification.readAt) await this.db.notification.updateMany({ where: { id, recipientUserId: userId, readAt: null }, data: { readAt: new Date() } });
    return this.db.notification.findUniqueOrThrow({ where: { id } });
  }
  async readAll(userId: string) {
    const result = await this.db.notification.updateMany({ where: { recipientUserId: userId, readAt: null }, data: { readAt: new Date() } });
    return { markedRead: result.count };
  }
}

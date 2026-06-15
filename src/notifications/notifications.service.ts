import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
  ) {
    return await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
      },
    });
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    return await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) throw new NotFoundException('Notification not found.');

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
      },
    });

    return { message: 'Notification marked as read.' };
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
      },
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      message: 'Unread notification retrieved successfully',
      count,
    };
  }
}

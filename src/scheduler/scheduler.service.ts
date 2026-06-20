import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GoalStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationsService,
  ) {}

  @Cron('0 0 0 * * *', {
    timeZone: 'Africa/Nairobi',
  })
  async markMaturedGoals() {
    const maturedGoals = await this.prisma.goal.findMany({
      where: {
        status: GoalStatus.ACTIVE,
        maturityDate: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    });

    if (maturedGoals.length === 0) {
      return;
    }

    await this.prisma.goal.updateMany({
      where: {
        id: {
          in: maturedGoals.map((goal) => goal.id),
        },
      },
      data: {
        status: GoalStatus.MATURED,
      },
    });

    await Promise.all(
      maturedGoals.map((goal) =>
        this.notification.createNotification(
          goal.userId,
          NotificationType.MATURITY,
          'Goal Matured',
          `Your goal "${goal.name}" has matured and is ready for withdrawal.`,
        ),
      ),
    );
  }
}

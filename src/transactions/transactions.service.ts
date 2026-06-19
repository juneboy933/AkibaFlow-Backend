import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import {
  Prisma,
  GoalStatus,
  TransactionStatus,
  TransactionType,
  NotificationType,
} from '@prisma/client';
import { money, percentage } from 'src/common/utils/money.utils';
import { NotificationsService } from 'src/notifications/notifications.service';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationsService,
    private readonly logger: LoggerService,
  ) {}

  async createDeposit(
    userId: string,
    dto: CreateDepositDto,
    receiptNumber?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (client: Prisma.TransactionClient) => {
      await client.$queryRaw`SELECT * FROM "Goal" WHERE id = ${dto.goalId} FOR UPDATE`;

      const existingGoal = await client.goal.findFirst({
        where: {
          id: dto.goalId,
          userId,
        },
      });

      if (!existingGoal) {
        throw new NotFoundException('Goal not found');
      }

      if (existingGoal.status !== GoalStatus.ACTIVE) {
        throw new BadRequestException('Goal is not active');
      }

      if (existingGoal.currentAmount.gte(existingGoal.targetAmount)) {
        throw new BadRequestException('Goal already completed');
      }

      const currentAmount = existingGoal.currentAmount;
      const targetAmount = existingGoal.targetAmount;
      const remainingAmount = targetAmount.minus(currentAmount);

      if (remainingAmount.lte(0)) {
        throw new BadRequestException('Goal has already reached its target');
      }

      const requestedAmount = money(dto.amount);
      const depositAmount = Prisma.Decimal.min(
        requestedAmount,
        remainingAmount,
      );

      const depositTx = await client.transaction.create({
        data: {
          userId,
          goalId: dto.goalId,
          amount: depositAmount,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.SUCCESS,
          reference: receiptNumber,
        },
      });

      const updatedGoal = await client.goal.update({
        where: {
          id: dto.goalId,
        },
        data: {
          currentAmount: {
            increment: depositAmount,
          },
        },
      });

      const completionPercentage = percentage(
        updatedGoal.currentAmount,
        updatedGoal.targetAmount,
      );

      if (updatedGoal.currentAmount.gte(updatedGoal.targetAmount)) {
        await client.goal.update({
          where: {
            id: dto.goalId,
          },
          data: {
            status: GoalStatus.COMPLETED,
          },
        });
      }

      await client.goalAnalytics.upsert({
        where: { goalId: dto.goalId },
        update: {
          actualAmount: updatedGoal.currentAmount,
          completionPercentage,
        },
        create: {
          goalId: dto.goalId,
          expectedAmount: updatedGoal.targetAmount,
          actualAmount: depositAmount,
          completionPercentage,
        },
      });

      await this.notification.createNotification(
        userId,
        NotificationType.DEPOSIT_SUCCESS,
        'Deposit successful',
        `KES ${depositAmount.toFixed(2)} deposited successfully.`,
      );

      return {
        message: depositAmount.lt(requestedAmount)
          ? `Goal completed. Only KES ${depositAmount.toFixed(2)} was deposited.`
          : 'Deposit successful',
        data: {
          transaction: depositTx,
          depositedAmount: depositAmount,
          requestedAmount: dto.amount,
          currentAmount: updatedGoal.currentAmount,
          targetAmount: updatedGoal.targetAmount,
        },
      };
    };

    if (tx) {
      return run(tx);
    }

    this.logger.log(`User ${userId} deposited KES ${dto.amount}`);
    return this.prisma.$transaction(run);
  }

  async createWithdraw(userId: string, dto: CreateWithdrawDto) {
    // Create a withdrawal transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if the goal exists and belongs to the user
      const existingGoal = await tx.goal.findFirst({
        where: { id: dto.goalId, userId },
      });

      if (!existingGoal) throw new NotFoundException('Goal not found');

      const isMaturedByTime = existingGoal.maturityDate <= new Date();

      const isWithdrawableStatus =
        existingGoal.status === GoalStatus.MATURED ||
        existingGoal.status === GoalStatus.COMPLETED;

      if (!isMaturedByTime || !isWithdrawableStatus) {
        throw new BadRequestException('Goal not withdrawable yet');
      }

      const withdrawAmount = existingGoal.currentAmount;

      if (withdrawAmount.isZero())
        throw new BadRequestException('No funds available.');
      const withdrawTx = await tx.transaction.create({
        data: {
          userId,
          goalId: dto.goalId,
          amount: withdrawAmount,
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.SUCCESS,
        },
      });

      // Update the goal's current amount
      const updatedGoal = await tx.goal.update({
        where: { id: dto.goalId },
        data: {
          currentAmount: money(0),
          status: GoalStatus.CLOSED,
        },
      });

      await tx.goalAnalytics.update({
        where: { goalId: dto.goalId },
        data: {
          actualAmount: money(0),
          completionPercentage: 0,
        },
      });

      return {
        message: 'Withdrawal successful',
        data: {
          transaction: withdrawTx,
          currentAmount: updatedGoal.currentAmount,
          targetAmount: updatedGoal.targetAmount,
        },
      };
    });

    await this.notification.createNotification(
      userId,
      NotificationType.WITHDRAWAL_SUCCESS,
      'Withdrawal successfull',
      `KES ${result.data.currentAmount.toFixed(2)} has been withdrawn.`,
    );

    this.logger.log(
      `User ${userId} withdraws KES ${result.data.currentAmount.toFixed(2)}`,
    );

    return result;
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const result = await this.prisma.transaction.findMany({
      where: { userId },
      include: {
        goal: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      message: 'Transactions retrieved successfully',
      data: result,
    };
  }

  async getTransactionById(userId: string, id: string) {
    const result = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        goal: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if (!result) throw new NotFoundException('Transaction not found');

    return {
      message: 'Transaction retrieved successfully',
      data: result,
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import { GoalStatus, TransactionStatus, TransactionType } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDeposit(userId: string, dto: CreateDepositDto) {
    const existingGoal = await this.prisma.goal.findFirst({
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

    const currentAmount = Number(existingGoal.currentAmount);
    const targetAmount = Number(existingGoal.targetAmount);

    const remainingAmount = targetAmount - currentAmount;

    if (remainingAmount <= 0) {
      throw new BadRequestException('Goal has already reached its target');
    }

    const depositAmount = Math.min(dto.amount, remainingAmount);

    return this.prisma.$transaction(async (tx) => {
      const depositTx = await tx.transaction.create({
        data: {
          userId,
          goalId: dto.goalId,
          amount: depositAmount,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.SUCCESS,
        },
      });

      const updatedGoal = await tx.goal.update({
        where: {
          id: dto.goalId,
        },
        data: {
          currentAmount: {
            increment: depositAmount,
          },
        },
      });

      const completionPercentage = Math.min(
        Math.floor(
          (Number(updatedGoal.currentAmount) /
            Number(updatedGoal.targetAmount)) *
            100,
        ),
        100,
      );

      if (
        Number(updatedGoal.currentAmount) >= Number(updatedGoal.targetAmount)
      ) {
        await tx.goal.update({
          where: {
            id: dto.goalId,
          },
          data: {
            status: GoalStatus.MATURED,
          },
        });
      }

      await tx.goalAnalytics.update({
        where: {
          goalId: dto.goalId,
        },
        data: {
          actualAmount: {
            increment: depositAmount,
          },
          completionPercentage,
        },
      });

      return {
        message:
          depositAmount < dto.amount
            ? `Goal completed. Only KES ${depositAmount} was deposited.`
            : 'Deposit successful',
        data: {
          transaction: depositTx,
          depositedAmount: depositAmount,
          requestedAmount: dto.amount,
          currentAmount: updatedGoal.currentAmount,
          targetAmount: updatedGoal.targetAmount,
        },
      };
    });
  }

  async createWithdraw(userId: string, dto: CreateWithdrawDto) {
    // Check if the goal exists and belongs to the user
    const existingGoal = await this.prisma.goal.findFirst({
      where: { id: dto.goalId, userId },
    });

    if (!existingGoal) throw new NotFoundException('Goal not found');

    // Check if the goal is matured
    if (existingGoal.status !== GoalStatus.MATURED) {
      throw new BadRequestException('Goal is not matured yet');
    }

    if (existingGoal.maturityDate > new Date()) {
      throw new BadRequestException('Goal has not matured yet');
    }

    // Check if the goal has sufficient funds
    if (Number(existingGoal.currentAmount) < dto.amount)
      throw new BadRequestException('Insufficient funds');

    // Create a withdrawal transaction
    return await this.prisma.$transaction(async (tx) => {
      const withdrawTx = await tx.transaction.create({
        data: {
          userId,
          goalId: dto.goalId,
          amount: dto.amount,
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.SUCCESS,
        },
      });

      // Update the goal's current amount
      const updatedGoal = await tx.goal.update({
        where: { id: dto.goalId },
        data: { currentAmount: { decrement: dto.amount } },
      });

      const completionPercentage = Math.max(
        0,
        Math.floor(
          (Number(updatedGoal.currentAmount) /
            Number(updatedGoal.targetAmount)) *
            100,
        ),
      );

      if (Number(updatedGoal.currentAmount) === 0) {
        await tx.goal.update({
          where: {
            id: dto.goalId,
          },
          data: {
            status: GoalStatus.CLOSED,
          },
        });
      }

      await tx.goalAnalytics.update({
        where: { goalId: dto.goalId },
        data: {
          actualAmount: { decrement: dto.amount },
          completionPercentage,
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
  }

  async getTransactions(userId: string) {
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

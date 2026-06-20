import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGoalDto } from './dto/create-goal.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalStatus } from '@prisma/client';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async createGoal(userId: string, dto: CreateGoalDto) {
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + dto.lockPeriod);

    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.goal.create({
        data: {
          userId,
          name: dto.name,
          description: dto.description,
          targetAmount: dto.targetAmount,
          lockPeriod: dto.lockPeriod,
          maturityDate,
        },
      });

      await tx.goalAnalytics.create({
        data: {
          goalId: goal.id,
          expectedAmount: dto.targetAmount,
          actualAmount: 0,
          completionPercentage: 0,
        },
      });

      this.logger.log(
        `User ${userId} created goal ${goal.id}`,
        GoalsService.name,
      );

      return {
        message: 'Goal created successfully',
        data: goal,
      };
    });
  }

  async getGoals(userId: string, page = 1, limit = 20) {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      include: { analytics: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.goal.count({
      where: { userId },
    });

    return {
      message: 'Goals retrieved successfully',
      data: goals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getGoalById(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: { analytics: true },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    return {
      message: 'Goal retrieved successfully',
      data: goal,
    };
  }

  async updateGoal(userId: string, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.getGoalById(userId, goalId);
    const updatedGoal = await this.prisma.goal.update({
      where: { id: goal.data.id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
    return {
      message: 'Goal updated successfully',
      data: updatedGoal,
    };
  }

  async closeGoal(userId: string, goalId: string) {
    const goal = await this.getGoalById(userId, goalId);
    if (goal.data.status === GoalStatus.ACTIVE && goal.data.currentAmount.gt(0))
      throw new BadRequestException('Cannot close an active funded goal.');

    const closedGoal = await this.prisma.goal.update({
      where: { id: goal.data.id },
      data: { status: GoalStatus.CLOSED },
    });

    this.logger.log(`User ${userId} closed goal ${goalId}`, GoalsService.name);

    return {
      message: 'Goal closed successfully',
      data: closedGoal,
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Goal,
  GoalStatus,
  NotificationType,
  PlanFrequency,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationsService,
  ) {}

  private async getGoal(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id: goalId,
        userId,
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return goal;
  }

  private async getActiveGoal(userId: string, goalId: string) {
    const goal = await this.getGoal(userId, goalId);

    if (goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException('Goal is not active');
    }

    if (goal.maturityDate <= new Date()) {
      throw new BadRequestException('Goal has already matured');
    }

    return goal;
  }

  private validatePlan(goal: Goal, amount: number, frequency: PlanFrequency) {
    if (amount <= 0) {
      throw new BadRequestException('Plan amount must be greater than zero');
    }

    const periods = this.calculatePeriods(goal.maturityDate, frequency);

    const projectedSavings = periods * amount;

    const remainingAmount =
      Number(goal.targetAmount) - Number(goal.currentAmount);

    if (projectedSavings < remainingAmount) {
      throw new BadRequestException(
        'Saving plan amount is too low to achieve the target',
      );
    }
  }

  private calculatePeriods(maturityDate: Date, frequency: PlanFrequency) {
    const millisecondsRemaining = maturityDate.getTime() - Date.now();

    const WEEK = 1000 * 60 * 60 * 24 * 7;

    const MONTH = 1000 * 60 * 60 * 24 * 30;

    return frequency === PlanFrequency.WEEKLY
      ? Math.ceil(millisecondsRemaining / WEEK)
      : Math.ceil(millisecondsRemaining / MONTH);
  }

  private calculateNextContributionDate(frequency: PlanFrequency) {
    if (frequency === PlanFrequency.WEEKLY) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const date = new Date();
    date.setMonth(date.getMonth() + 1);

    return date;
  }

  private calculateCompletionPercentage(
    currentAmount: number,
    targetAmount: number,
  ) {
    return Math.min(Math.floor((currentAmount / targetAmount) * 100), 100);
  }

  async createPlan(userId: string, dto: CreatePlanDto) {
    const goal = await this.getActiveGoal(userId, dto.goalId);

    const existingPlan = await this.prisma.savingPlan.findFirst({
      where: {
        goalId: dto.goalId,
        isActive: true,
      },
    });

    if (existingPlan) {
      throw new BadRequestException('Goal already has an active saving plan');
    }

    this.validatePlan(goal, dto.amount, dto.frequency);

    const plan = await this.prisma.savingPlan.create({
      data: {
        goalId: dto.goalId,
        amount: dto.amount,
        frequency: dto.frequency,
        nextContributionDate: this.calculateNextContributionDate(dto.frequency),
      },
    });

    await this.notification.createNotification(
      userId,
      NotificationType.PLAN_CREATED,
      'Savings Plan Created',
      `Your ${dto.frequency.toLowerCase()} savings plan has been created.`,
    );

    await this.prisma.goalAnalytics.upsert({
      where: {
        goalId: dto.goalId,
      },
      update: {},
      create: {
        goalId: dto.goalId,
        expectedAmount: goal.targetAmount,
        actualAmount: goal.currentAmount,
        completionPercentage: this.calculateCompletionPercentage(
          Number(goal.currentAmount),
          Number(goal.targetAmount),
        ),
      },
    });

    return {
      message: 'Saving plan created successfully',
      data: plan,
    };
  }

  async getPlanByGoal(userId: string, goalId: string) {
    await this.getGoal(userId, goalId);

    const plan = await this.prisma.savingPlan.findFirst({
      where: {
        goalId,
        isActive: true,
      },
      include: {
        goal: {
          select: {
            id: true,
            name: true,
            targetAmount: true,
            currentAmount: true,
            maturityDate: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Saving plan not found');
    }

    return {
      message: 'Saving plan retrieved successfully',
      data: plan,
    };
  }

  async getPlans(userId: string) {
    const plans = await this.prisma.savingPlan.findMany({
      where: {
        isActive: true,
        goal: {
          userId,
        },
      },
      include: {
        goal: {
          select: {
            id: true,
            name: true,
            targetAmount: true,
            currentAmount: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      message: 'Plans retrieved successfully',
      data: plans,
    };
  }

  async updatePlan(userId: string, goalId: string, dto: UpdatePlanDto) {
    const goal = await this.getActiveGoal(userId, goalId);

    const existingPlan = await this.prisma.savingPlan.findFirst({
      where: {
        goalId,
        isActive: true,
      },
    });

    if (!existingPlan) {
      throw new NotFoundException('Saving plan not found');
    }

    const amount = dto.amount ?? Number(existingPlan.amount);

    const frequency = dto.frequency ?? existingPlan.frequency;

    this.validatePlan(goal, amount, frequency);

    const frequencyChanged = frequency !== existingPlan.frequency;

    const updatedPlan = await this.prisma.savingPlan.update({
      where: {
        goalId,
      },
      data: {
        amount,
        frequency,
        nextContributionDate: frequencyChanged
          ? this.calculateNextContributionDate(frequency)
          : existingPlan.nextContributionDate,
      },
    });

    return {
      message: 'Saving plan updated successfully',
      data: updatedPlan,
    };
  }

  async deletePlan(userId: string, goalId: string) {
    await this.getActiveGoal(userId, goalId);

    const plan = await this.prisma.savingPlan.findFirst({
      where: {
        goalId,
        isActive: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Saving plan not found');
    }

    await this.prisma.savingPlan.update({
      where: {
        goalId,
      },
      data: {
        isActive: false,
      },
    });

    return {
      message: 'Saving plan deleted successfully',
    };
  }
}

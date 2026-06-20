import { GoalStatus, PlanFrequency, Prisma } from '@prisma/client';
import { PlansService } from './plans.service';

describe('PlansService money flows', () => {
  const notification = {
    createNotification: jest.fn(),
  };

  const logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reactivates a soft-deleted saving plan instead of creating a duplicate row', async () => {
    const goal = {
      id: 'goal-1',
      userId: 'user-1',
      name: 'School Fees',
      description: null,
      targetAmount: new Prisma.Decimal(1000),
      currentAmount: new Prisma.Decimal(100),
      lockPeriod: 2,
      startDate: new Date(),
      maturityDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: GoalStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existingPlan = {
      id: 'plan-1',
      goalId: 'goal-1',
      amount: new Prisma.Decimal(100),
      frequency: PlanFrequency.WEEKLY,
      nextContributionDate: new Date(),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const prisma = {
      savingPlan: {
        findUnique: jest.fn().mockResolvedValue(existingPlan),
        update: jest.fn().mockResolvedValue({
          ...existingPlan,
          amount: new Prisma.Decimal(200),
          isActive: true,
        }),
        create: jest.fn(),
      },
      goalAnalytics: {
        upsert: jest.fn(),
      },
    };

    const goals = {
      getGoalById: jest.fn().mockResolvedValue({
        message: 'Goal retrieved successfully',
        data: goal,
      }),
    };

    const service = new PlansService(
      prisma as never,
      notification as never,
      goals as never,
      logger as never,
    );

    await service.createPlan('user-1', {
      goalId: 'goal-1',
      frequency: PlanFrequency.WEEKLY,
      amount: 200,
    });

    expect(prisma.savingPlan.update).toHaveBeenCalledWith({
      where: { goalId: 'goal-1' },
      data: expect.objectContaining({
        amount: 200,
        frequency: PlanFrequency.WEEKLY,
        isActive: true,
      }),
    });
    expect(prisma.savingPlan.create).not.toHaveBeenCalled();
  });
});

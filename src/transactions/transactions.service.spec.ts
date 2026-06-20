import { BadRequestException } from '@nestjs/common';
import { GoalStatus, Prisma, TransactionStatus } from '@prisma/client';
import { TransactionsService } from './transactions.service';

describe('TransactionsService money flows', () => {
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

  it('locks and rereads a goal before creating a pending withdrawal request', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      goal: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'goal-1',
          userId: 'user-1',
          status: GoalStatus.MATURED,
          maturityDate: new Date(Date.now() - 1000),
          currentAmount: new Prisma.Decimal(500),
          targetAmount: new Prisma.Decimal(1000),
          user: {
            phone: '0712345678',
          },
        }),
        update: jest.fn().mockResolvedValue({
          currentAmount: new Prisma.Decimal(0),
          targetAmount: new Prisma.Decimal(1000),
        }),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({
          id: 'transaction-1',
          amount: new Prisma.Decimal(500),
          status: TransactionStatus.PENDING,
        }),
      },
      withdrawal: {
        create: jest.fn().mockResolvedValue({
          id: 'withdrawal-1',
          transactionId: 'transaction-1',
          amount: new Prisma.Decimal(500),
          phone: '254712345678',
        }),
      },
      goalAnalytics: {
        update: jest.fn(),
      },
    };

    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    const service = new TransactionsService(
      prisma as never,
      notification as never,
      logger as never,
    );

    const result = await service.createWithdraw('user-1', { goalId: 'goal-1' });

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.goal.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: TransactionStatus.PENDING,
      }),
    });
    expect(tx.withdrawal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionId: 'transaction-1',
        phone: '254712345678',
      }),
    });
    expect(result.message).toBe('Withdrawal request received');
  });

  it('does not create a withdrawal when the locked goal has no funds', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      goal: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'goal-1',
          userId: 'user-1',
          status: GoalStatus.MATURED,
          maturityDate: new Date(Date.now() - 1000),
          currentAmount: new Prisma.Decimal(0),
          targetAmount: new Prisma.Decimal(1000),
        }),
      },
      transaction: {
        create: jest.fn(),
      },
    };

    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    const service = new TransactionsService(
      prisma as never,
      notification as never,
      logger as never,
    );

    await expect(
      service.createWithdraw('user-1', { goalId: 'goal-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});

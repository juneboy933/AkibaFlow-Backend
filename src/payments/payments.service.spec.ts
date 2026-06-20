import { BadRequestException } from '@nestjs/common';
import { GoalStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService money flows', () => {
  const mpesa = {
    stkPush: jest.fn(),
  };

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

  it('blocks a new STK push when the goal already has an active payment', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      goal: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'goal-1',
          status: GoalStatus.ACTIVE,
          targetAmount: new Prisma.Decimal(1000),
          currentAmount: new Prisma.Decimal(100),
        }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: PaymentStatus.PENDING,
        }),
      },
    };

    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-1', phone: '0712345678' }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    const service = new PaymentsService(
      prisma as never,
      {} as never,
      mpesa as never,
      notification as never,
      logger as never,
    );

    await expect(
      service.initiatePayment('user-1', {
        goalId: 'goal-1',
        phone: '0712345678',
        amount: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mpesa.stkPush).not.toHaveBeenCalled();
  });

  it('marks a paid callback as unallocated when goal crediting fails', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      goalId: 'goal-1',
      amount: new Prisma.Decimal(100),
      phone: '254712345678',
      status: PaymentStatus.PENDING,
    };

    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
        callback({}),
      ),
    };

    const transactions = {
      createDeposit: jest
        .fn()
        .mockRejectedValue(new BadRequestException('Goal is not active')),
    };

    const service = new PaymentsService(
      prisma as never,
      transactions as never,
      mpesa as never,
      notification as never,
      logger as never,
    );

    await expect(
      service.handleCallback({
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-1',
            CheckoutRequestID: 'checkout-1',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 100 },
                { Name: 'MpesaReceiptNumber', Value: 'RCP123' },
                { Name: 'PhoneNumber', Value: 254712345678 },
              ],
            },
          },
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payment.updateMany).toHaveBeenLastCalledWith({
      where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
      data: expect.objectContaining({
        status: PaymentStatus.PAID_UNALLOCATED,
      }),
    });
  });
});

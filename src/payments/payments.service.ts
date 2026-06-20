import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { MpesaService } from 'src/mpesa/mpesa.service';
import {
  GoalStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-stkPush.dto';
import { MpesaCallbackDto } from './dto/callback.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { normalizePhone } from 'src/common/utils/phone.utils';
import { money } from 'src/common/utils/money.utils';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transaction: TransactionsService,
    private readonly mpesa: MpesaService,
    private readonly notification: NotificationsService,
    private readonly logger: LoggerService,
  ) {}

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const userPhone = normalizePhone(user.phone);
    const requestPhone = normalizePhone(dto.phone);

    if (userPhone !== requestPhone) {
      throw new BadRequestException('Phone number mismatch');
    }

    const pendingAttempt = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT * FROM "Goal" WHERE id = ${dto.goalId} FOR UPDATE`;

      const goal = await tx.goal.findFirst({
        where: { id: dto.goalId, userId },
      });

      if (!goal) throw new NotFoundException('Goal not found');
      if (goal.status !== GoalStatus.ACTIVE) {
        throw new BadRequestException('Goal not active');
      }

      const activePayment = await tx.payment.findFirst({
        where: {
          goalId: dto.goalId,
          userId,
          status: {
            in: [
              PaymentStatus.PENDING,
              PaymentStatus.PROCESSING,
              PaymentStatus.PAID_UNALLOCATED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (activePayment) {
        throw new BadRequestException(
          'This goal already has a payment being processed',
        );
      }

      const requestedAmount = money(dto.amount);
      const remaining = goal.targetAmount.minus(goal.currentAmount);

      if (remaining.lte(0)) {
        throw new BadRequestException('Goal already completed');
      }

      const amount = Prisma.Decimal.min(requestedAmount, remaining);

      const payment = await tx.payment.create({
        data: {
          userId,
          goalId: dto.goalId,
          amount,
          phone: requestPhone,
          status: PaymentStatus.PENDING,
        },
      });

      return { amount, payment, requestedAmount };
    });

    try {
      const stk = await this.mpesa.stkPush({
        amount: pendingAttempt.amount.toNumber(),
        phone: requestPhone,
      });

      if (stk.ResponseCode !== '0') {
        await this.prisma.payment.update({
          where: { id: pendingAttempt.payment.id },
          data: {
            status: PaymentStatus.FAILED,
            resultDescription: stk.ResponseDescription,
          },
        });

        throw new BadRequestException(stk.ResponseDescription);
      }

      const updatedPayment = await this.prisma.payment.update({
        where: { id: pendingAttempt.payment.id },
        data: {
          merchantRequestId: stk.MerchantRequestID,
          checkoutRequestId: stk.CheckoutRequestID,
        },
      });

      return {
        message: pendingAttempt.amount.lt(pendingAttempt.requestedAmount)
          ? `Only KES ${pendingAttempt.amount.toFixed(2)} required to complete goal`
          : 'STK Push sent',
        data: updatedPayment,
      };
    } catch (err) {
      await this.prisma.payment.updateMany({
        where: { id: pendingAttempt.payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.FAILED,
          resultDescription: (err as Error).message,
        },
      });

      throw err;
    }
  }

  async handleCallback(dto: MpesaCallbackDto) {
    const cb = dto.Body.stkCallback;
    const checkoutId = cb.CheckoutRequestID;

    this.logger.log(
      `Processing M-Pesa callback | checkoutId=${checkoutId}`,
      PaymentsService.name,
    );

    const payment = await this.prisma.payment.findUnique({
      where: { checkoutRequestId: checkoutId },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    // HARD IDEMPOTENCY GUARD
    if (payment.status === PaymentStatus.SUCCESS) {
      return { message: 'Already processed' };
    }

    if (payment.status === PaymentStatus.PAID_UNALLOCATED) {
      return { message: 'Payment awaiting reconciliation' };
    }

    if (cb.ResultCode !== 0) {
      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: {
            not: PaymentStatus.SUCCESS,
          },
        },
        data: {
          status: PaymentStatus.FAILED,
          resultDescription: cb.ResultDesc,
        },
      });

      await this.notification.createNotification(
        payment.userId,
        NotificationType.FAILED_DEPOSIT,
        'Deposit failed',
        'Your Mpesa deposit could not be completed.',
      );

      this.logger.error(
        `Deposit failed | payment=${payment.id} | user=${payment.userId} | reason=${cb.ResultDesc}`,
        PaymentsService.name,
      );

      return { message: 'Payment failed' };
    }

    const receipt = cb.CallbackMetadata?.Item?.find(
      (i) => i.Name === 'MpesaReceiptNumber',
    )?.Value;

    const callbackAmount = cb.CallbackMetadata?.Item?.find(
      (i) => i.Name === 'Amount',
    )?.Value;

    const callbackPhone = cb.CallbackMetadata?.Item?.find(
      (i) => i.Name === 'PhoneNumber',
    )?.Value;

    if (!receipt) {
      // Treat missing receipt as a failed payment and record the failure
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
        data: {
          status: PaymentStatus.FAILED,
          resultDescription: 'Missing receipt number in callback',
        },
      });

      await this.notification.createNotification(
        payment.userId,
        NotificationType.FAILED_DEPOSIT,
        'Deposit failed',
        'Your Mpesa deposit could not be completed (missing receipt).',
      );

      this.logger.error(
        `Missing receipt | payment=${payment.id} | user=${payment.userId} | checkoutId=${checkoutId}`,
        PaymentsService.name,
      );

      return { message: 'Missing receipt number' };
    }

    const amountMatches =
      callbackAmount === undefined ||
      money(callbackAmount).equals(payment.amount);

    const phoneMatches =
      callbackPhone === undefined ||
      String(callbackPhone) === String(payment.phone);

    if (!amountMatches || !phoneMatches) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
        data: {
          status: PaymentStatus.PAID_UNALLOCATED,
          mpesaReceiptNumber: String(receipt),
          resultDescription: `Callback metadata mismatch: amount=${callbackAmount}, phone=${callbackPhone}`,
        },
      });

      await this.notification.createNotification(
        payment.userId,
        NotificationType.FAILED_DEPOSIT,
        'Deposit needs review',
        'Your M-Pesa payment was received but needs review before being added to your goal.',
      );

      this.logger.error(
        `Payment metadata mismatch | payment=${payment.id} | expectedAmount=${payment.amount.toFixed(2)} | callbackAmount=${callbackAmount} | expectedPhone=${payment.phone} | callbackPhone=${callbackPhone}`,
        PaymentsService.name,
      );

      return { message: 'Payment awaiting reconciliation' };
    }

    // atomic lock (prevents double processing)
    const locked = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.PROCESSING,
        mpesaReceiptNumber: String(receipt),
      },
    });

    if (locked.count === 0) {
      const freshPayment = await this.prisma.payment.findUnique({
        where: { id: payment.id },
      });

      if (freshPayment?.status === PaymentStatus.SUCCESS) {
        return { message: 'Already processed' };
      }

      return { message: 'Already processing' };
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const deposit = await this.transaction.createDeposit(
          payment.userId,
          {
            goalId: payment.goalId,
            amount: payment.amount.toNumber(),
          },
          String(receipt),
          tx,
        );

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS,
            transactionId: deposit.data.transaction.id,
          },
        });

        return { deposit, updatedPayment };
      });

      const goal = await this.prisma.goal.findUnique({
        where: { id: result.updatedPayment.goalId },
      });

      await this.notification.createNotification(
        result.updatedPayment.userId,
        NotificationType.DEPOSIT_SUCCESS,
        'Deposit successful',
        `Kes ${result.updatedPayment.amount.toFixed(2)} has been added to ${goal?.name}.`,
      );

      this.logger.log(
        `Deposit succeeded | payment=${payment.id} | user=${payment.userId} | goal=${goal?.id} | amount=${result.updatedPayment.amount.toFixed(2)}`,
        PaymentsService.name,
      );

      return {
        message: 'Payment successful',
        data: result.updatedPayment,
      };
    } catch (err) {
      // A successful M-Pesa callback with a receipt means money moved. If
      // allocation fails, keep it reconcilable instead of calling it failed.
      try {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
          data: {
            status: PaymentStatus.PAID_UNALLOCATED,
            resultDescription: String(
              (err as Error)?.message ?? 'Processing error',
            ),
          },
        });
      } catch (uErr) {
        this.logger.error(
          `Failed to mark payment as unallocated | payment=${payment.id} | err=${(uErr as Error).message}`,
          PaymentsService.name,
        );
      }

      try {
        await this.notification.createNotification(
          payment.userId,
          NotificationType.FAILED_DEPOSIT,
          'Deposit needs review',
          'Your M-Pesa payment was received but needs review before being added to your goal.',
        );
      } catch (nErr) {
        this.logger.error(
          `Failed to send failure notification | payment=${payment.id} | err=${(nErr as Error).message}`,
          PaymentsService.name,
        );
      }

      this.logger.error(
        `Deposit processing error | payment=${payment.id} | user=${payment.userId} | checkoutId=${checkoutId} | err=${(err as Error).stack ?? (err as Error).message}`,
        PaymentsService.name,
      );

      throw err;
    }
  }
}

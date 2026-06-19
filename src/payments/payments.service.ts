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

    const goal = await this.prisma.goal.findFirst({
      where: { id: dto.goalId, userId },
    });

    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException('Goal not active');
    }

    const requestedAmount = money(dto.amount);
    const remaining = goal.targetAmount.minus(goal.currentAmount);

    if (remaining.lte(0)) {
      throw new BadRequestException('Goal already completed');
    }

    const amount = Prisma.Decimal.min(requestedAmount, remaining);

    const stk = await this.mpesa.stkPush({
      amount: amount.toNumber(),
      phone: requestPhone,
    });

    if (stk.ResponseCode !== '0') {
      throw new BadRequestException(stk.ResponseDescription);
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        goalId: dto.goalId,
        amount: amount,
        phone: requestPhone,
        status: PaymentStatus.PENDING,
        merchantRequestId: stk.MerchantRequestID,
        checkoutRequestId: stk.CheckoutRequestID,
      },
    });

    return {
      message: amount.lt(requestedAmount)
        ? `Only KES ${amount.toFixed(2)} required to complete goal`
        : 'STK Push sent',
      data: payment,
    };
  }

  async handleCallback(dto: MpesaCallbackDto) {
    const cb = dto.Body.stkCallback;
    const checkoutId = cb.CheckoutRequestID;

    this.logger.log(`Processing M-Pesa callback | checkoutId=${checkoutId}`);

    const payment = await this.prisma.payment.findUnique({
      where: { checkoutRequestId: checkoutId },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    // HARD IDEMPOTENCY GUARD
    if (payment.status === PaymentStatus.SUCCESS) {
      return { message: 'Already processed' };
    }

    if (cb.ResultCode !== 0) {
      await this.prisma.payment.update({
        where: { id: payment.id },
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
      );

      return { message: 'Payment failed' };
    }

    const receipt = cb.CallbackMetadata?.Item?.find(
      (i) => i.Name === 'MpesaReceiptNumber',
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
      );

      return { message: 'Missing receipt number' };
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
      );

      return {
        message: 'Payment successful',
        data: result.updatedPayment,
      };
    } catch (err) {
      // Ensure payment is marked as FAILED unless it's already SUCCESS
      try {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
          data: {
            status: PaymentStatus.FAILED,
            resultDescription: String(
              (err as Error)?.message ?? 'Processing error',
            ),
          },
        });
      } catch (uErr) {
        this.logger.error(
          `Failed to update payment status to FAILED | payment=${payment.id} | err=${(uErr as Error).message}`,
        );
      }

      try {
        await this.notification.createNotification(
          payment.userId,
          NotificationType.FAILED_DEPOSIT,
          'Deposit failed',
          'Your Mpesa deposit could not be completed.',
        );
      } catch (nErr) {
        this.logger.error(
          `Failed to send failure notification | payment=${payment.id} | err=${(nErr as Error).message}`,
        );
      }

      this.logger.error(
        `Deposit processing error | payment=${payment.id} | user=${payment.userId} | checkoutId=${checkoutId} | err=${(err as Error).stack ?? (err as Error).message}`,
      );

      throw err;
    }
  }
}

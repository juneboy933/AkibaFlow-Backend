import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { MpesaService } from 'src/mpesa/mpesa.service';
import { GoalStatus, PaymentStatus } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-stkPush.dto';
import { MpesaCallbackDto } from './dto/callback.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transaction: TransactionsService,
    private readonly mpesa: MpesaService,
  ) {}

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.phone !== dto.phone) {
      throw new BadRequestException('Phone number mismatch');
    }

    const goal = await this.prisma.goal.findFirst({
      where: { id: dto.goalId, userId },
    });

    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException('Goal not active');
    }

    const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);

    if (remaining <= 0) {
      throw new BadRequestException('Goal already completed');
    }

    const amount = Math.min(dto.amount, remaining);

    const stk = await this.mpesa.stkPush({
      amount,
      phone: dto.phone,
    });

    if (stk.ResponseCode !== '0') {
      throw new BadRequestException(stk.ResponseDescription);
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        goalId: dto.goalId,
        amount: amount.toString(),
        phone: dto.phone,
        status: PaymentStatus.PENDING,
        merchantRequestId: stk.MerchantRequestID,
        checkoutRequestId: stk.CheckoutRequestID,
      },
    });

    return {
      message:
        amount < dto.amount
          ? `Only KES ${amount} required to complete goal`
          : 'STK Push sent',
      data: payment,
    };
  }

  async handleCallback(dto: MpesaCallbackDto) {
    const cb = dto.Body.stkCallback;
    const checkoutId = cb.CheckoutRequestID;

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

      return { message: 'Payment failed' };
    }

    const receipt = cb.CallbackMetadata?.Item?.find(
      (i) => i.Name === 'MpesaReceiptNumber',
    )?.Value;

    if (!receipt) {
      throw new BadRequestException('Missing receipt number');
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
      return { message: 'Already processing' };
    }

    try {
      const deposit = await this.transaction.createDeposit(
        payment.userId,
        {
          goalId: payment.goalId,
          amount: Number(payment.amount),
        },
        String(receipt),
      );

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          transactionId: deposit.data.transaction.id,
        },
      });

      return {
        message: 'Payment successful',
        data: updated,
      };
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });

      throw err;
    }
  }
}

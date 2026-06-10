import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GoalStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-stkPush.dto';
import { MpesaCallbackDto } from './dto/callback.dto';
import { TransactionsService } from 'src/transactions/transactions.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transaction: TransactionsService,
  ) {}

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.phone !== dto.phone) {
      throw new BadRequestException('Phone number does not match account');
    }

    const goal = await this.prisma.goal.findFirst({
      where: {
        id: dto.goalId,
        userId,
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException(
        'Payments can only be made to active goals',
      );
    }

    const currentAmount = Number(goal.currentAmount);
    const targetAmount = Number(goal.targetAmount);

    const remainingAmount = targetAmount - currentAmount;

    if (remainingAmount <= 0) {
      throw new BadRequestException(
        'Goal has already reached its target amount',
      );
    }

    const paymentAmount = Math.min(dto.amount, remainingAmount);

    // TODO:
    // const stkResponse = await this.mpesaService.stkPush(...)

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        goalId: dto.goalId,
        amount: paymentAmount.toString(),
        phone: dto.phone,
        status: PaymentStatus.PENDING,

        // merchantRequestId: stkResponse.MerchantRequestID,
        // checkoutRequestId: stkResponse.CheckoutRequestID,
      },
    });

    return {
      message:
        paymentAmount < dto.amount
          ? `Only KES ${paymentAmount} is required to complete this goal`
          : 'STK Push initiated successfully',

      data: {
        paymentId: payment.id,
        status: payment.status,
        requestedAmount: dto.amount,
        paymentAmount,
        currentAmount,
        targetAmount,
        remainingAfterPayment: Math.max(0, remainingAmount - paymentAmount),
      },
    };
  }

  async handleCallback(dto: MpesaCallbackDto) {
    const callback = dto.Body.stkCallback;

    const { CheckoutRequestID, ResultCode } = callback;

    const payment = await this.prisma.payment.findUnique({
      where: {
        checkoutRequestId: CheckoutRequestID,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return {
        message: 'Payment already processed',
      };
    }

    if (payment.status === PaymentStatus.PROCESSING) {
      return {
        message: 'Payment is already being processed',
      };
    }

    if (ResultCode !== 0) {
      await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      return {
        message: 'Payment failed',
      };
    }

    const metadata = callback.CallbackMetadata?.Item ?? [];

    const receiptNumber = metadata
      .find((item) => item.Name === 'MpesaReceiptNumber')
      ?.Value?.toString();

    if (!receiptNumber) {
      throw new BadRequestException('Receipt number missing from callback');
    }

    await this.prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.PROCESSING,
        mpesaReceiptNumber: receiptNumber,
      },
    });

    try {
      const depositResult = await this.transaction.createDeposit(
        payment.userId,
        {
          goalId: payment.goalId,
          amount: Number(payment.amount),
        },
      );

      const transactionId = depositResult.data.transaction.id;

      const updatedPayment = await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.SUCCESS,
          transactionId,
        },
      });

      return {
        message: 'Payment processed successfully',
        data: {
          payment: updatedPayment,
          transactionId,
          receiptNumber,
        },
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      throw error;
    }
  }
}

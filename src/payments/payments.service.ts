import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GoalStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-stkPush.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.phone !== dto.phone)
      throw new BadRequestException('Phone number does not match account');

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

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        goalId: dto.goalId,
        amount: paymentAmount.toString(),
        status: PaymentStatus.PENDING,
        phone: dto.phone,
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
}

import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-stkPush.dto';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import { Request } from 'express';
import { UserRole } from '@prisma/client';

interface AuthenticatedUser extends Request {
  user: {
    sub: string;
    role: UserRole;
  };
}

@UseGuards(JwtGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payment: PaymentsService) {}

  @Post('stk-push')
  initiatePayment(
    @Req() req: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.payment.initiatePayment(req.user.sub, dto);
  }
}

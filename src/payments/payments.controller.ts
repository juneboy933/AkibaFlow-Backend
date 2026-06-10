import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-stkPush.dto';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { MpesaCallbackDto } from './dto/callback.dto';

interface AuthenticatedUser extends Request {
  user: {
    sub: string;
    role: UserRole;
  };
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payment: PaymentsService) {}

  @Post('stk-push')
  @UseGuards(JwtGuard)
  initiatePayment(
    @Req() req: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.payment.initiatePayment(req.user.sub, dto);
  }

  @Post('callback')
  handleCallback(@Body() dto: MpesaCallbackDto) {
    return this.payment.handleCallback(dto);
  }
}

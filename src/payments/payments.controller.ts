import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-stkPush.dto';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import { MpesaCallbackDto } from './dto/callback.dto';
import type { AuthenticatedRequest } from 'src/common/interfaces/authenticated-user.interface';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payment: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Post('stk-push')
  @UseGuards(JwtGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  initiatePayment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.payment.initiatePayment(req.user.sub, dto);
  }

  @Post('callback')
  handleCallback(
    @Headers('x-callback-secret') secret: string,
    @Body() dto: MpesaCallbackDto,
  ) {
    if (secret !== this.config.get<string>('MPESA_CALLBACK_SECRET')) {
      throw new UnauthorizedException('Invalid callback');
    }
    return this.payment.handleCallback(dto);
  }
}

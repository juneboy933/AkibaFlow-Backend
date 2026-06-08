import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    role: UserRole;
  };
}

@UseGuards(JwtGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transaction: TransactionsService) {}

  @Post('deposit')
  createDeposit(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateDepositDto,
  ) {
    return this.transaction.createDeposit(req.user.sub, dto);
  }

  @Post('withdraw')
  createWithdraw(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWithdrawDto,
  ) {
    return this.transaction.createWithdraw(req.user.sub, dto);
  }

  @Get()
  getTransactions(@Req() req: AuthenticatedRequest) {
    return this.transaction.getTransactions(req.user.sub);
  }

  @Get(':id')
  getTransactionById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.transaction.getTransactionById(req.user.sub, id);
  }
}

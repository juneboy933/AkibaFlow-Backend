import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { MpesaModule } from 'src/mpesa/mpesa.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TransactionsModule,
    MpesaModule,
    NotificationsModule,
    LoggerModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

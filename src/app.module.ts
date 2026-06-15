import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { GoalsModule } from './goals/goals.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PaymentsModule } from './payments/payments.module';
import { MpesaModule } from './mpesa/mpesa.module';
import { PlansModule } from './plans/plans.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotifiactionsService } from './notifiactions/notifiactions.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    GoalsModule,
    TransactionsModule,
    PaymentsModule,
    MpesaModule,
    PlansModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, NotifiactionsService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { GoalsModule } from './goals/goals.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PaymentsModule } from './payments/payments.module';
import { MpesaModule } from './mpesa/mpesa.module';
import { PlansModule } from './plans/plans.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler/scheduler.service';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    GoalsModule,
    TransactionsModule,
    PaymentsModule,
    MpesaModule,
    PlansModule,
    NotificationsModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),
    ScheduleModule.forRoot(),
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'CONFIG_VALIDATION',
      useFactory: (config: ConfigService) => {
        const required = [
          'DATABASE_URL',
          'JWT_SECRET',
          'MPESA_CONSUMER_KEY',
          'MPESA_CONSUMER_SECRET',
          'MPESA_BASE_URL',
          'MPESA_SHORTCODE',
          'MPESA_PASSKEY',
          'MPESA_CALLBACK_URL',
          'MPESA_CALLBACK_SECRET',
          'FRONTEND_URL',
        ];
        const missing = required.filter((k) => !config.get(k));
        if (missing.length) {
          throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`,
          );
        }
        return true;
      },
      inject: [ConfigService],
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    SchedulerService,
  ],
})
export class AppModule {}

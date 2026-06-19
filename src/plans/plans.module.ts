import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { GoalsModule } from 'src/goals/goals.module';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationsModule,
    GoalsModule,
    LoggerModule,
  ],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}

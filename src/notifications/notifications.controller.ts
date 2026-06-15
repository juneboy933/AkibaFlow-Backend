import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';

interface AuthenticatedUser extends Request {
  user: {
    sub: string;
    role: UserRole;
  };
}

@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notification: NotificationsService) {}

  @Get()
  getNotifications(
    @Req() req: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.notification.getNotifications(
      req.user.sub,
      Number(page),
      Number(limit),
    );
  }

  @Get('count')
  unreadCount(@Req() req: AuthenticatedUser) {
    return this.notification.unreadCount(req.user.sub);
  }

  @Patch(':id')
  markAsRead(@Req() req: AuthenticatedUser, @Param('id') id: string) {
    return this.notification.markAsRead(req.user.sub, id);
  }

  @Patch()
  markAllAsRead(@Req() req: AuthenticatedUser) {
    return this.notification.markAllAsRead(req.user.sub);
  }
}

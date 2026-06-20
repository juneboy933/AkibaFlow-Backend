import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import type { AuthenticatedRequest } from 'src/common/interfaces/authenticated-user.interface';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notification: NotificationsService) {}

  @Get()
  getNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationDto,
  ) {
    return this.notification.getNotifications(
      req.user.sub,
      query.page,
      query.limit,
    );
  }

  @Get('count')
  unreadCount(@Req() req: AuthenticatedRequest) {
    return this.notification.unreadCount(req.user.sub);
  }

  @Patch(':id')
  markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notification.markAsRead(req.user.sub, id);
  }

  @Patch()
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notification.markAllAsRead(req.user.sub);
  }
}

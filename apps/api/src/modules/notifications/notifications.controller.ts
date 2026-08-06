import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  async list(
    @CurrentUser() user: { id: string; role: string },
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    const audience = user.role ? 'ADMIN' : 'CUSTOMER';
    return this.notifications.list(audience as any, user.id, page, pageSize);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count' })
  async unreadCount(@CurrentUser() user: { id: string; role: string }) {
    const audience = user.role ? 'ADMIN' : 'CUSTOMER';
    const count = await this.notifications.unreadCount(audience as any, user.id);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.notifications.markRead(id, user.id);
    return { ok: true };
  }
}

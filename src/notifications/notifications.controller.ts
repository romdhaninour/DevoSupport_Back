import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: any) {
    const userRole = req.user?.role;
    return this.notificationsService.findAll(userRole);
  }

  @Get('unread')
  findUnread(@Req() req: any) {
    const userRole = req.user?.role;
    return this.notificationsService.findUnread(userRole);
  }

  @Get('unread/count')
  getUnreadCount(@Req() req: any) {
    const userRole = req.user?.role;
    return this.notificationsService.getUnreadCount(userRole);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: any) {
    const userRole = req.user?.role;
    return this.notificationsService.markAllAsRead(userRole);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}

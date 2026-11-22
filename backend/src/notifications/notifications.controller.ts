import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type Principal } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQuery } from '../marketplace/dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() @ApiOperation({ summary: 'My in-app notifications' }) @ApiResponse({ status: 200 })
  list(@CurrentUser() user: Principal, @Query() page: PageQuery) { return this.notifications.list(user.id, page.limit, page.offset); }
  @Get('unread-count') @ApiOperation({ summary: 'My unread notification count' }) @ApiResponse({ status: 200 })
  count(@CurrentUser() user: Principal) { return this.notifications.unreadCount(user.id); }
  @Post('read-all') @ApiOperation({ summary: 'Mark all my notifications read' }) @ApiResponse({ status: 201 })
  readAll(@CurrentUser() user: Principal) { return this.notifications.readAll(user.id); }
  @Post(':id/read') @ApiOperation({ summary: 'Mark one owned notification read' }) @ApiResponse({ status: 201 }) @ApiResponse({ status: 404 })
  read(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.notifications.read(user.id, id); }
}

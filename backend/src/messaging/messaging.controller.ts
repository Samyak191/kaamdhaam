import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type Principal } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQuery } from '../marketplace/dto';
import { MarkReadDto, MessageQuery, SendMessageDto } from './dto';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('me/conversations')
export class MyConversationsController {
  constructor(private readonly messaging: MessagingService) {}
  @Get() @ApiOperation({ summary: 'Contract conversations with unread counts' }) @ApiResponse({ status: 200 })
  list(@CurrentUser() user: Principal, @Query() page: PageQuery) { return this.messaging.list(user.id, page.limit, page.offset); }
}

@ApiTags('Messaging') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('conversations')
export class ConversationsController {
  constructor(private readonly messaging: MessagingService) {}
  @Get(':id/messages') @ApiOperation({ summary: 'Cursor-paginated message history; fetching does not mark read' }) @ApiResponse({ status: 200 }) @ApiResponse({ status: 404 })
  messages(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Query() query: MessageQuery) { return this.messaging.messages(user.id, id, query); }
  @Post(':id/messages') @ApiOperation({ summary: 'Send text while contract is active; sender comes from JWT' }) @ApiResponse({ status: 201 }) @ApiResponse({ status: 409 })
  send(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Body() body: SendMessageDto) { return this.messaging.send(user.id, id, body.body); }
  @Post(':id/read') @ApiOperation({ summary: 'Advance own explicit read cursor' }) @ApiResponse({ status: 201 }) @ApiResponse({ status: 404 })
  read(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string, @Body() body: MarkReadDto) { return this.messaging.markRead(user.id, id, body.throughSequence); }
}

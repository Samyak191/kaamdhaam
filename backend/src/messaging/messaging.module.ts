import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationsController, MyConversationsController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({ imports: [AuthModule], controllers: [ConversationsController, MyConversationsController], providers: [MessagingService] })
export class MessagingModule {}

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto, CreateConversationDto, MarkAsReadDto } from './dto/chat.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
  ) {}

  /**
   * Create a new conversation
   */
  @Post('conversations')
  async createConversation(
    @Body() createConversationDto: CreateConversationDto,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.createConversation(createConversationDto, userId);
  }

  /**
   * Get all conversations for the current user
   */
  @Get('conversations')
  async getConversations(@CurrentUser() userId: string) {
    return this.chatService.getUserConversations(userId);
  }

  /**
   * Get a specific conversation with messages
   */
  @Get('conversations/:conversationId')
  async getConversation(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit: string = '50',
    @Query('skip') skip: string = '0',
    @CurrentUser() userId: string,
  ) {
    return this.chatService.getConversation(
      conversationId,
      userId,
      parseInt(limit),
      parseInt(skip),
    );
  }

  /**
   * Send a message
   */
  @Post('messages')
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
    @CurrentUser() userId: string,
  ) {
    const message = await this.chatService.sendMessage(sendMessageDto, userId);
    
    // Broadcast to all users in the conversation via Socket.io
    this.chatGateway.broadcastMessage(
      sendMessageDto.conversationId,
      message,
    );

    return message;
  }

  /**
   * Mark messages as read
   */
  @Post('messages/mark-read')
  async markAsRead(
    @Body() markAsReadDto: MarkAsReadDto,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.markMessagesAsRead(markAsReadDto, userId);
  }

  /**
   * Get unread message count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() userId: string) {
    const count = await this.chatService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  /**
   * Delete a message
   */
  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.deleteMessage(messageId, userId);
  }

  /**
   * Archive a conversation
   */
  @Post('conversations/:conversationId/archive')
  @HttpCode(HttpStatus.OK)
  async archiveConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.archiveConversation(conversationId, userId);
  }

  /**
   * Add participant to conversation
   */
  @Post('conversations/:conversationId/participants')
  async addParticipant(
    @Param('conversationId') conversationId: string,
    @Body() body: { participantId: string },
    @CurrentUser() userId: string,
  ) {
    return this.chatService.addParticipant(
      conversationId,
      body.participantId,
      userId,
    );
  }

  /**
   * Remove participant from conversation
   */
  @Delete('conversations/:conversationId/participants/:participantId')
  @HttpCode(HttpStatus.OK)
  async removeParticipant(
    @Param('conversationId') conversationId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.removeParticipant(
      conversationId,
      participantId,
      userId,
    );
  }
}

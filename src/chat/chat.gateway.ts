import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { SendMessageDto, MarkAsReadDto } from './dto/chat.dto';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    userEmail?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(private chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Chat Gateway initialized');
  }

  /**
   * Handle client connection and token verification
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        this.logger.warn(`Connection rejected - no token: ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT token using the same access secret used by auth strategy.
      let decoded: any;
      try {
        const accessSecret =
          process.env.JWT_SECRET ?? process.env.ACCESS_TOKEN_SECRET;

        if (!accessSecret) {
          this.logger.error('Missing JWT secret for chat gateway');
          client.emit('error', { message: 'Server auth configuration error' });
          client.disconnect();
          return;
        }

        decoded = jwt.verify(token, accessSecret);
      } catch (error) {
        this.logger.warn(`Connection rejected - invalid token: ${client.id}`);
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect();
        return;
      }

      const userId = decoded.sub as string;
      const userEmail = decoded.email as string;

      // Attach user info to socket
      client.data.userId = userId;
      client.data.userEmail = userEmail;

      // Track user's active sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Connection established

      // Emit connection confirmation
      client.emit('connected', {
        userId,
        socketId: client.id,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    try {
      const userId = client.data.userId;

      if (userId) {
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(client.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
      }

      // Disconnected
    } catch (error) {
      this.logger.error(`Disconnection error: ${error}`);
    }
  }

  /**
   * Join a conversation room
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const { conversationId } = data;
      const userId = client.data.userId;
      const roomId = conversationId.toString();

      if (!conversationId) {
        this.logger.warn(
          `Join failed - missing conversation ID, socket: ${client.id}`,
        );
        client.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      // Verify user is part of the conversation (simpler check without full populate)
      let hasAccess = false;
      let conversationData: any = null;
      try {
        conversationData = await this.chatService.getConversation(
          conversationId,
          userId,
          1,
          0,
        );
        hasAccess = conversationData ? true : false;
      } catch (error) {
        // If getConversation throws access denied, the user is not allowed
        this.logger.error(
          `❌ Access check failed for user ${userId} on conversation ${roomId}: ${error instanceof Error ? error.message : error}`,
        );
        client.emit('error', {
          message: 'Conversation not found or access denied',
        });
        return;
      }

      if (!hasAccess) {
        this.logger.warn(
          `❌ User ${userId} has no access to conversation ${roomId} (hasAccess=false)`,
        );
        client.emit('error', {
          message: 'Conversation not found or access denied',
        });
        return;
      }

      // Join the room
      client.join(roomId);

      // Emit acknowledgement to the client who joined
      client.emit('roomJoined', {
        conversationId,
        success: true,
      });

      // Notify others in the room
      this.server.to(roomId).emit('userJoined', {
        userId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `❌ Join room error: ${error instanceof Error ? error.message : error}`,
      );
      this.logger.error(`Stack:`, error);
      client.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to join room',
      });
    }
  }

  /**
   * Leave a conversation room
   */
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const { conversationId } = data;
      const userId = client.data.userId;

      if (!conversationId) {
        client.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      const roomId = conversationId.toString();
      client.leave(roomId);

      // Notify others in the room
      this.server.to(roomId).emit('userLeft', {
        userId,
        timestamp: new Date(),
      });

      client.emit('roomLeft', {
        conversationId,
        success: true,
      });
    } catch (error) {
      this.logger.error(`Leave room error: ${error}`);
      client.emit('error', {
        message:
          error instanceof Error ? error.message : 'Failed to leave room',
      });
    }
  }

  /**
   * Send a message in a conversation
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const userId = client.data.userId;
      const roomId = data.conversationId.toString();

      if (!data.conversationId || !data.content?.trim()) {
        this.logger.warn(
          `[SEND] Validation failed - missing data from user ${userId}`,
        );
        client.emit('error', {
          message: 'Conversation ID and content required',
        });
        return;
      }

      if (!client.rooms.has(roomId)) {
        client.emit('error', { message: 'You must join the room first' });
        return;
      }

      // Save message to database
      const message = await this.chatService.sendMessage(data, userId);
      await message.populate('senderId', 'name email');

      // Get sender info safely - cast after populate
      const sender = message.senderId as any;
      const senderName = sender && sender.name ? sender.name : 'Unknown';
      const senderEmail =
        sender && sender.email ? sender.email : client.data.userEmail;

      const messagePayload = {
        _id: message._id,
        messageId: message._id,
        conversationId: data.conversationId,
        senderId: message.senderId._id || message.senderId,
        senderName,
        senderEmail,
        content: message.content,
        attachments: message.attachments || [],
        readBy: message.readBy || [],
        isDeleted: message.isDeleted || false,
        createdAt: message.createdAt,
      };

      // Broadcast to all users in the conversation (including sender)
      this.server.to(roomId).emit('messageReceived', messagePayload);
    } catch (error) {
      this.logger.error(
        `❌ Send message error: ${error instanceof Error ? error.message : error}`,
      );
      this.logger.error(`Stack:`, error);
      client.emit('error', {
        message:
          error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  }

  /**
   * Mark messages as read
   */
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: MarkAsReadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const userId = client.data.userId;

      if (!data.conversationId) {
        client.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      await this.chatService.markMessagesAsRead(data, userId);

      // Notify others
      const roomId = data.conversationId.toString();
      this.server.to(roomId).emit('messagesRead', {
        userId,
        conversationId: data.conversationId,
        messageIds: data.messageIds,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Mark as read error: ${error}`);
      client.emit('error', {
        message:
          error instanceof Error ? error.message : 'Failed to mark as read',
      });
    }
  }

  /**
   * Notify others when user is typing
   */
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    try {
      const userId = client.data.userId;
      const { conversationId } = data;

      if (!conversationId) {
        return;
      }

      // Notify everyone except sender
      client.to(conversationId).emit('userTyping', {
        userId,
        conversationId,
      });
    } catch (error) {
      this.logger.error(`Typing error: ${error}`);
    }
  }

  /**
   * Notify others when user stops typing
   */
  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    try {
      const userId = client.data.userId;
      const { conversationId } = data;

      if (!conversationId) {
        return;
      }

      // Notify everyone else
      client.to(conversationId).emit('userStoppedTyping', {
        userId,
        conversationId,
      });
    } catch (error) {
      this.logger.error(`Stop typing error: ${error}`);
    }
  }

  /**
   * Helper method: broadcast to specific users
   */
  notifyUser(userId: string, event: string, data: any): void {
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      userSocketIds.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  /**
   * Broadcast message to all users in a conversation (called from REST API)
   */
  async broadcastMessage(conversationId: string, message: any): Promise<void> {
    try {
      // Ensure sender info is populated
      if (message.senderId && typeof message.senderId !== 'string') {
        await message.populate('senderId', 'name email');
      }

      // Get sender info safely - cast after populate
      const sender = message.senderId;
      const senderName = sender && sender.name ? sender.name : 'Unknown';
      const senderEmail =
        sender && sender.email ? sender.email : 'unknown@email.com';
      const senderId = sender && sender._id ? sender._id : message.senderId;

      // Use consistent string conversion for room ID
      const roomId = conversationId.toString();
      this.server.to(roomId).emit('messageReceived', {
        _id: message._id,
        messageId: message._id,
        conversationId,
        senderId,
        senderName,
        senderEmail,
        content: message.content,
        attachments: message.attachments || [],
        readBy: message.readBy || [],
        isDeleted: message.isDeleted || false,
        createdAt: message.createdAt,
      });
    } catch (error) {
      this.logger.error(`❌ Broadcast message error: ${error}`);
    }
  }
}

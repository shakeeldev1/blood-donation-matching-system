import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from './schemas/message.schema';
import { Conversation } from './schemas/conversation.schema';
import { SendMessageDto, CreateConversationDto, MarkAsReadDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
  ) {}

  /**
   * Create a new conversation
   */
  async createConversation(
    createConversationDto: CreateConversationDto,
    userId: string,
  ) {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const participantObjectIds = createConversationDto.participants.map(
        (id) => new Types.ObjectId(id),
      );

      // Ensure the creator is included in participants
      if (!participantObjectIds.some((id) => id.equals(userObjectId))) {
        participantObjectIds.push(userObjectId);
      }

      // Check if private conversation already exists
      if (createConversationDto.type === 'private' && participantObjectIds.length === 2) {
        const existingConversation = await this.conversationModel.findOne({
          type: 'private',
          participants: {
            $all: participantObjectIds.map((id) => new Types.ObjectId(id)),
            $size: 2,
          },
        });

        if (existingConversation) {
          return existingConversation;
        }
      }

      const conversation = new this.conversationModel({
        ...createConversationDto,
        participants: participantObjectIds,
        createdBy: userObjectId,
      });

      await conversation.save();
      return conversation;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string) {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const conversations = await this.conversationModel
        .find({
          participants: userObjectId,
          isArchived: { $ne: true },
        })
        .populate('lastMessage')
        .populate('participants', 'name email')
        .sort({ lastMessageAt: -1 })
        .exec();

      return conversations;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch conversations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single conversation with messages
   */
  async getConversation(conversationId: string, userId: string, limit = 50, skip = 0) {
    try {
      const conversationObjectId = new Types.ObjectId(conversationId);
      const userObjectId = new Types.ObjectId(userId);

      const conversation = await this.conversationModel
        .findById(conversationObjectId)
        .populate('participants', 'name email')
        .populate('createdBy', 'name email')
        .exec();

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Check if user is a participant
      if (!conversation.participants.some((p: any) => p._id.equals(userObjectId))) {
        throw new ForbiddenException('You do not have access to this conversation');
      }

      // Get messages
      const messages = await this.messageModel
        .find({
          conversationId: conversationObjectId,
          isDeleted: { $ne: true },
        })
        .populate('senderId', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .exec();

      const totalMessages = await this.messageModel.countDocuments({
        conversationId: conversationObjectId,
        isDeleted: { $ne: true },
      });

      return {
        conversation,
        messages: messages.reverse(),
        total: totalMessages,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    sendMessageDto: SendMessageDto,
    userId: string,
  ) {
    try {
      const conversationObjectId = new Types.ObjectId(sendMessageDto.conversationId);
      const userObjectId = new Types.ObjectId(userId);

      // Verify conversation exists and user is a participant
      const conversation = await this.conversationModel.findById(conversationObjectId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!conversation.participants.some((p) => p.equals(userObjectId))) {
        throw new ForbiddenException('You do not have access to this conversation');
      }

      // Create message
      const message = new this.messageModel({
        conversationId: conversationObjectId,
        senderId: userObjectId,
        content: sendMessageDto.content,
        attachments: sendMessageDto.attachments || [],
        readBy: [userObjectId],
      });

      await message.save();

      // Update conversation's last message
      await this.conversationModel.findByIdAndUpdate(
        conversationObjectId,
        {
          lastMessage: message._id,
          lastMessageAt: new Date(),
        },
        { new: true },
      );

      // Populate sender info
      await message.populate('senderId', 'name email');

      return message;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Mark message as read
   */
  async markMessagesAsRead(
    markAsReadDto: MarkAsReadDto,
    userId: string,
  ) {
    try {
      const conversationObjectId = new Types.ObjectId(markAsReadDto.conversationId);
      const userObjectId = new Types.ObjectId(userId);

      // Verify user is a participant
      const conversation = await this.conversationModel.findById(conversationObjectId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!conversation.participants.some((p) => p.equals(userObjectId))) {
        throw new ForbiddenException('You do not have access to this conversation');
      }

      // If specific message IDs provided, mark those as read
      if (markAsReadDto.messageIds && markAsReadDto.messageIds.length > 0) {
        const messageObjectIds = markAsReadDto.messageIds.map(
          (id) => new Types.ObjectId(id),
        );

        await this.messageModel.updateMany(
          { _id: { $in: messageObjectIds } },
          {
            $addToSet: { readBy: userObjectId },
          },
        );
      } else {
        // Mark all messages in conversation as read
        await this.messageModel.updateMany(
          { conversationId: conversationObjectId },
          {
            $addToSet: { readBy: userObjectId },
          },
        );
      }

      // Update conversation readAt timestamp
      const readAtMap = conversation.readAt || new Map();
      readAtMap.set(userId, new Date());

      await this.conversationModel.findByIdAndUpdate(
        conversationObjectId,
        { readAt: readAtMap },
      );

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to mark messages as read: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string) {
    try {
      const userObjectId = new Types.ObjectId(userId);

      const unreadConversations = await this.conversationModel.aggregate([
        {
          $match: {
            participants: userObjectId,
            isArchived: { $ne: true },
          },
        },
        {
          $lookup: {
            from: 'messages',
            localField: '_id',
            foreignField: 'conversationId',
            as: 'messages',
          },
        },
        {
          $project: {
            unreadCount: {
              $size: {
                $filter: {
                  input: '$messages',
                  as: 'msg',
                  cond: { $not: { $in: [userObjectId, '$$msg.readBy'] } },
                },
              },
            },
          },
        },
        {
          $match: { unreadCount: { $gt: 0 } },
        },
        {
          $group: {
            _id: null,
            totalUnread: { $sum: '$unreadCount' },
          },
        },
      ]);

      return unreadConversations[0]?.totalUnread || 0;
    } catch (error) {
      throw new BadRequestException(
        `Failed to get unread count: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string) {
    try {
      const messageObjectId = new Types.ObjectId(messageId);
      const userObjectId = new Types.ObjectId(userId);

      const message = await this.messageModel.findById(messageObjectId);

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (!message.senderId.equals(userObjectId)) {
        throw new ForbiddenException('You can only delete your own messages');
      }

      await this.messageModel.findByIdAndUpdate(messageObjectId, {
        isDeleted: true,
        deletedAt: new Date(),
        content: '[Deleted]',
      });

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string, userId: string) {
    try {
      const conversationObjectId = new Types.ObjectId(conversationId);
      const userObjectId = new Types.ObjectId(userId);

      const conversation = await this.conversationModel.findById(conversationObjectId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!conversation.participants.some((p) => p.equals(userObjectId))) {
        throw new ForbiddenException('You do not have access to this conversation');
      }

      await this.conversationModel.findByIdAndUpdate(
        conversationObjectId,
        {
          isArchived: true,
          archivedAt: new Date(),
        },
        { new: true },
      );

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to archive conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Add participant to conversation
   */
  async addParticipant(conversationId: string, participantId: string, userId: string) {
    try {
      const conversationObjectId = new Types.ObjectId(conversationId);
      const userObjectId = new Types.ObjectId(userId);
      const participantObjectId = new Types.ObjectId(participantId);

      const conversation = await this.conversationModel.findById(conversationObjectId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Only group admins or original creator can add participants
      if (conversation.type === 'group' && !conversation.createdBy?.equals(userObjectId)) {
        throw new ForbiddenException('Only group creator can add participants');
      }

      if (conversation.participants.some((p) => p.equals(participantObjectId))) {
        throw new BadRequestException('Participant already in conversation');
      }

      await this.conversationModel.findByIdAndUpdate(
        conversationObjectId,
        {
          $push: { participants: participantObjectId },
        },
        { new: true },
      );

      return { success: true };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to add participant: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Remove participant from conversation
   */
  async removeParticipant(conversationId: string, participantId: string, userId: string) {
    try {
      const conversationObjectId = new Types.ObjectId(conversationId);
      const userObjectId = new Types.ObjectId(userId);
      const participantObjectId = new Types.ObjectId(participantId);

      const conversation = await this.conversationModel.findById(conversationObjectId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Users can remove themselves, but only creators can remove others
      if (
        !participantObjectId.equals(userObjectId) &&
        !conversation.createdBy?.equals(userObjectId)
      ) {
        throw new ForbiddenException('You cannot remove this participant');
      }

      await this.conversationModel.findByIdAndUpdate(
        conversationObjectId,
        {
          $pull: { participants: participantObjectId },
        },
        { new: true },
      );

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to remove participant: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

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
import { User } from 'src/user/schemas/user.schema';
import { Donor } from 'src/donor/schemas/donor.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Donor.name)
    private donorModel: Model<Donor>,
  ) {}

  private toObjectId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid id: ${value}`);
    }
    return new Types.ObjectId(value);
  }

  private async getUserAliasIds(userId: string): Promise<{ userObjectId: Types.ObjectId; donorObjectId?: Types.ObjectId }> {
    const userObjectId = this.toObjectId(userId);
    const donor = await this.donorModel
      .findOne({ userId: userObjectId })
      .select('_id')
      .lean()
      .exec();

    return {
      userObjectId,
      donorObjectId: donor?._id ? new Types.ObjectId(donor._id) : undefined,
    };
  }

  private async resolveToUserId(possibleUserOrDonorId: Types.ObjectId): Promise<Types.ObjectId> {
    const userExists = await this.userModel
      .exists({ _id: possibleUserOrDonorId })
      .exec();
    if (userExists) {
      return possibleUserOrDonorId;
    }

    const donor = await this.donorModel
      .findById(possibleUserOrDonorId)
      .select('userId')
      .lean()
      .exec();

    if (donor?.userId) {
      return new Types.ObjectId(donor.userId);
    }

    return possibleUserOrDonorId;
  }

  private async normalizeConversationParticipants(conversationId: Types.ObjectId, participants: Types.ObjectId[]) {
    const normalized = await Promise.all(
      participants.map((id) => this.resolveToUserId(new Types.ObjectId(id))),
    );

    const uniqueNormalized = Array.from(
      new Map(normalized.map((id) => [id.toString(), id])).values(),
    );

    const changed =
      uniqueNormalized.length !== participants.length ||
      uniqueNormalized.some((id, idx) => !participants[idx]?.equals?.(id));

    if (!changed) {
      return;
    }

    await this.conversationModel
      .updateOne(
        { _id: conversationId },
        { $set: { participants: uniqueNormalized } },
      )
      .exec();
  }

  private participantMatchesAnyId(participant: any, allowedIds: Types.ObjectId[]) {
    const candidate = participant?._id ?? participant;
    if (candidate && typeof candidate.equals === 'function') {
      return allowedIds.some((id) => candidate.equals(id));
    }
    return allowedIds.some((id) => id.toString() === String(candidate));
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    createConversationDto: CreateConversationDto,
    userId: string,
  ) {
    try {
      const { userObjectId } = await this.getUserAliasIds(userId);

      const resolvedParticipantIds = await Promise.all(
        createConversationDto.participants.map(async (id) => {
          const objectId = this.toObjectId(id);
          return this.resolveToUserId(objectId);
        }),
      );

      const participantObjectIds = Array.from(
        new Map(resolvedParticipantIds.map((id) => [id.toString(), id])).values(),
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
      const { userObjectId, donorObjectId } = await this.getUserAliasIds(userId);
      const participantMatchIds = donorObjectId ? [userObjectId, donorObjectId] : [userObjectId];

      // Step 1: find by either User._id or Donor._id (legacy conversations)
      const candidateConversations = await this.conversationModel
        .find({
          participants: { $in: participantMatchIds },
          isArchived: { $ne: true },
        })
        .select('_id participants')
        .lean()
        .exec();

      // Step 2: normalize any legacy participant ids (Donor._id -> User._id)
      await Promise.all(
        candidateConversations.map((conv) =>
          this.normalizeConversationParticipants(
            new Types.ObjectId(conv._id),
            (conv.participants as any[]).map((p) => new Types.ObjectId(p)),
          ),
        ),
      );

      // Step 3: fetch again with normal population
      const conversations = await this.conversationModel
        .find({
          participants: userObjectId,
          isArchived: { $ne: true },
        })
        .populate('lastMessage')
        .populate('participants', 'name email')
        .sort({ lastMessageAt: -1, createdAt: -1, _id: -1 })
        .exec();

      // Attach unreadCount per conversation for this user
      const conversationIds = conversations
        .map((c) => c._id)
        .filter(Boolean)
        .map((id) => new Types.ObjectId(id));

      const unreadCountsByConversationId = new Map<string, number>();
      if (conversationIds.length > 0) {
        const unreadAgg = await this.messageModel
          .aggregate([
            {
              $match: {
                conversationId: { $in: conversationIds },
                isDeleted: { $ne: true },
                senderId: { $ne: userObjectId },
                readBy: {
                  $not: {
                    $elemMatch: { $eq: userObjectId },
                  },
                },
              },
            },
            {
              $group: {
                _id: '$conversationId',
                unreadCount: { $sum: 1 },
              },
            },
          ])
          .exec();

        for (const row of unreadAgg) {
          if (row?._id) {
            unreadCountsByConversationId.set(String(row._id), Number(row.unreadCount) || 0);
          }
        }
      }

      return conversations.map((c) => {
        const obj = c.toObject({ virtuals: true });
        const unreadCount = unreadCountsByConversationId.get(String(c._id)) ?? 0;
        return { ...obj, unreadCount };
      });
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
      const conversationObjectId = this.toObjectId(conversationId);
      const { userObjectId, donorObjectId } = await this.getUserAliasIds(userId);
      const allowedIds = donorObjectId ? [userObjectId, donorObjectId] : [userObjectId];

      const rawConversation = await this.conversationModel.findById(conversationObjectId).exec();
      if (!rawConversation) {
        throw new NotFoundException('Conversation not found');
      }

      await this.normalizeConversationParticipants(
        conversationObjectId,
        rawConversation.participants as unknown as Types.ObjectId[],
      );

      const normalizedConversationRaw = await this.conversationModel
        .findById(conversationObjectId)
        .select('participants')
        .lean()
        .exec();

      const normalizedParticipants: Types.ObjectId[] =
        (normalizedConversationRaw?.participants as any[])?.map((p) => new Types.ObjectId(p)) ?? [];

      // Now populate (participants are normalized to User ids when possible)
      const conversation = await this.conversationModel
        .findById(conversationObjectId)
        .populate('participants', 'name email')
        .populate('createdBy', 'name email')
        .exec();

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      const isParticipant = normalizedParticipants.some((p) =>
        allowedIds.some((allowed) => p.equals(allowed)),
      );

      if (!isParticipant) {
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
      const conversationObjectId = this.toObjectId(sendMessageDto.conversationId);
      const { userObjectId, donorObjectId } = await this.getUserAliasIds(userId);
      const allowedIds = donorObjectId ? [userObjectId, donorObjectId] : [userObjectId];

      // Verify conversation exists and user is a participant
      const conversation = await this.conversationModel.findById(conversationObjectId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      await this.normalizeConversationParticipants(
        conversationObjectId,
        conversation.participants as unknown as Types.ObjectId[],
      );

      if (!conversation.participants.some((p: any) => this.participantMatchesAnyId(p, allowedIds))) {
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
      const conversationObjectId = this.toObjectId(markAsReadDto.conversationId);
      const { userObjectId, donorObjectId } = await this.getUserAliasIds(userId);
      const allowedIds = donorObjectId ? [userObjectId, donorObjectId] : [userObjectId];

      // Verify user is a participant
      const conversation = await this.conversationModel.findById(conversationObjectId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      await this.normalizeConversationParticipants(
        conversationObjectId,
        conversation.participants as unknown as Types.ObjectId[],
      );

      if (!conversation.participants.some((p: any) => this.participantMatchesAnyId(p, allowedIds))) {
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
      const { userObjectId, donorObjectId } = await this.getUserAliasIds(userId);
      const participantMatchIds = donorObjectId ? [userObjectId, donorObjectId] : [userObjectId];

      const unreadConversations = await this.conversationModel.aggregate([
        {
          $match: {
            participants: { $in: participantMatchIds },
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

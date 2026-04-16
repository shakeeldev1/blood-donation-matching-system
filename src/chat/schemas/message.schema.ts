import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  attachments?: string[];

  @Prop({ default: false })
  isEdited?: boolean;

  @Prop()
  editedAt?: Date;

  @Prop({ default: false })
  isDeleted?: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  readBy?: Types.ObjectId[];

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Create compound index for efficient queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

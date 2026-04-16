import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: ['private', 'group', 'support'] })
  type!: 'private' | 'group' | 'support';

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  participants!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage?: Types.ObjectId;

  @Prop()
  lastMessageAt?: Date;

  @Prop({ default: '' })
  description?: string;

  @Prop({ default: '' })
  avatar?: string;

  @Prop({ type: Map, of: Date, default: new Map() })
  readAt?: Map<string, Date>;

  @Prop({ default: false })
  isArchived?: boolean;

  @Prop()
  archivedAt?: Date;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  mutedBy?: Types.ObjectId[];

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Create indexes for efficient queries
ConversationSchema.index({ participants: 1, createdAt: -1 });
ConversationSchema.index({ createdBy: 1 });
ConversationSchema.index({ type: 1 });

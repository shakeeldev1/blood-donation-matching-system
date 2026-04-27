import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AdminCampaign extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ default: '' })
  location!: string;

  @Prop({ default: '' })
  startDate!: string;

  @Prop({ default: '' })
  endDate!: string;

  @Prop({
    required: true,
    enum: ['Active', 'Completed', 'Upcoming'],
    default: 'Upcoming',
  })
  status!: string;

  @Prop({ default: 0 })
  participantsCount!: number;

  @Prop({ default: 0 })
  targetCount!: number;
}

export const AdminCampaignSchema = SchemaFactory.createForClass(AdminCampaign);

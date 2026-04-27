import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AdminReview extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  email?: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: true })
  text!: string;

  @Prop({ default: '' })
  location!: string;

  @Prop({ default: 'Donor' })
  type!: string;

  @Prop({ required: true, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' })
  status!: string;
}

export const AdminReviewSchema = SchemaFactory.createForClass(AdminReview);

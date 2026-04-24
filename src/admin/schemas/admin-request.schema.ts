import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AdminRequest extends Document {
  @Prop({ required: true })
  patient!: string;

  @Prop({ required: true })
  hospital!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ default: '' })
  reason!: string;

  @Prop({ required: true })
  bloodType!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({
    required: true,
    enum: ['Emergency', 'Urgent', 'Normal'],
    default: 'Normal',
  })
  urgency!: string;

  @Prop({
    required: true,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  })
  status!: string;
}

export const AdminRequestSchema = SchemaFactory.createForClass(AdminRequest);

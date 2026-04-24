import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class DonorAppointment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  hospital!: string;

  @Prop({ required: true })
  date!: string;

  @Prop({ required: true })
  time!: string;

  @Prop({ required: true })
  location!: string;

  @Prop({
    required: true,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Pending',
  })
  status!: string;

  @Prop({
    required: true,
    enum: ['Whole Blood', 'Platelets', 'Plasma', 'Organ'],
    default: 'Whole Blood',
  })
  type!: string;
}

export const DonorAppointmentSchema =
  SchemaFactory.createForClass(DonorAppointment);

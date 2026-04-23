import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AdminComplaint extends Document {
  @Prop({ required: true })
  from!: string;

  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true, enum: ['High', 'Medium', 'Low'], default: 'Low' })
  priority!: string;

  @Prop({ required: true, enum: ['Pending', 'Resolved', 'Rejected'], default: 'Pending' })
  status!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop()
  resolution?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;
}

export const AdminComplaintSchema = SchemaFactory.createForClass(AdminComplaint);
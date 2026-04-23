import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AdminRecipient extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ default: 30 })
  age!: number;

  @Prop({ default: 'Other' })
  gender!: string;

  @Prop({ required: true })
  bloodType!: string;

  @Prop({ required: true })
  hospital!: string;

  @Prop({ default: 'Unknown' })
  city!: string;

  @Prop({ default: 'N/A' })
  phone!: string;

  @Prop({ required: true, enum: ['Active', 'Inactive'], default: 'Active' })
  status!: string;

  @Prop()
  requestDate?: string;
}

export const AdminRecipientSchema = SchemaFactory.createForClass(AdminRecipient);
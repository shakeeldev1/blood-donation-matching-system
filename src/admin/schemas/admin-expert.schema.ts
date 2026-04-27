import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AdminExpert extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ default: '' })
  image!: string;

  @Prop({ default: '' })
  linkedin?: string;

  @Prop({ default: '' })
  twitter?: string;

  @Prop({ default: '' })
  email?: string;

  @Prop({ required: true, enum: ['Active', 'Inactive'], default: 'Active' })
  status!: string;
}

export const AdminExpertSchema = SchemaFactory.createForClass(AdminExpert);

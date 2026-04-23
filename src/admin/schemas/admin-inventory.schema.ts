import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AdminInventory extends Document {
  @Prop({ required: true, unique: true })
  bloodType!: string;

  @Prop({ required: true, default: 0, min: 0 })
  available!: number;

  @Prop({ required: true, default: 0, min: 0 })
  reserved!: number;

  @Prop({ required: true, default: 0, min: 0 })
  expired!: number;

  @Prop()
  lastUpdated?: string;
}

export const AdminInventorySchema = SchemaFactory.createForClass(AdminInventory);
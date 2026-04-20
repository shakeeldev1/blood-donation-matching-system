import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  stripePaymentIntentId: string;

  @Prop({ required: true, enum: ['pending', 'succeeded', 'failed', 'canceled'] })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['blood_purchase', 'donation_support', 'campaign'] })
  paymentType: string;

  @Prop({})
  bloodType?: string;

  @Prop({})
  units?: number;

  @Prop({})
  recipientId?: Types.ObjectId;

  @Prop({ default: null })
  transactionId: string;

  @Prop({ default: null })
  receiptUrl: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

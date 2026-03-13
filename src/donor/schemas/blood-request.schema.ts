import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class BloodRequest extends Document {
  @Prop()
  requesterUserId?: string;

  @Prop()
  requesterName?: string;

  @Prop()
  requesterEmail?: string;

  @Prop({ required: true })
  patientName!: string;

  @Prop({ required: true })
  hospital!: string;

  @Prop({ required: true })
  location!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] })
  bloodGroup!: string;

  @Prop({ required: true, min: 1 })
  units!: number;

  @Prop({ required: true, enum: ['Critical', 'High', 'Moderate'], default: 'Moderate' })
  urgency!: 'Critical' | 'High' | 'Moderate';

  @Prop({ required: true })
  contact!: string;

  @Prop({ required: true, min: 0.1 })
  distanceKm!: number;

  @Prop({
    required: true,
    enum: ['Pending', 'Accepted', 'Fulfilled', 'Closed'],
    default: 'Pending',
  })
  status!: 'Pending' | 'Accepted' | 'Fulfilled' | 'Closed';
}

export const BloodRequestSchema = SchemaFactory.createForClass(BloodRequest);

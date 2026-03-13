import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Donor extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  })
  bloodGroup!: string;

  @Prop({
    required: true,
    enum: ['Blood', 'Plasma', 'Organ'],
    default: 'Blood',
  })
  donationType!: string;

  @Prop({ required: true, min: 18, max: 65 })
  age!: number;

  @Prop({ required: true })
  weight!: string;

  @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
  gender!: string;

  @Prop({ default: 'None' })
  medicalConditions!: string;

  @Prop()
  lastDonation?: string;

  @Prop({ default: true })
  availability!: boolean;

  @Prop({ enum: ['Free', 'Paid'], default: 'Free' })
  status!: string;

  @Prop({ default: 5 })
  rating!: number;

  @Prop()
  image?: string;
}

export const DonorSchema = SchemaFactory.createForClass(Donor);

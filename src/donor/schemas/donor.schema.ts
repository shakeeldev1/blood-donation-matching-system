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

  @Prop()
  height?: string; // in cm, for BMI calculation

  @Prop()
  bmi?: number; // Calculated: weight(kg) / (height(m)^2)

  @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
  gender!: string;

  @Prop({ default: 'None' })
  medicalConditions!: string;

  @Prop()
  bloodPressure?: string; // Format: 120/80

  @Prop()
  hemoglobinLevel?: number; // in g/dL, typical 13.5-17.5 for men, 12-15.5 for women

  @Prop()
  lastHealthCheckup?: string; // Date: YYYY-MM-DD

  @Prop({ default: false })
  hasTattooOrPiercing?: boolean;

  @Prop()
  tattooOrPiercingDetails?: string; // If yes, when was it done

  @Prop()
  currentMedications?: string; // List of medications being taken

  @Prop()
  allergies?: string; // Allergy information

  @Prop()
  dietaryRestrictions?: string; // e.g., Vegetarian, Vegan, etc.

  @Prop()
  lastDonation?: string;

  @Prop({ default: true })
  availability!: boolean;

  @Prop({ enum: ['Free', 'Paid'], default: 'Free' })
  status!: string;

  @Prop({ min: 0, max: 100 })
  serviceFee?: number; // In currency units (e.g., USD), only used when status is 'Paid'

  @Prop({ default: 5 })
  rating!: number;

  @Prop()
  image?: string;

  @Prop({
    type: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      urgentAlerts: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
    },
    default: {
      email: true,
      sms: false,
      urgentAlerts: true,
      promotions: false,
    },
  })
  notificationSettings!: {
    email: boolean;
    sms: boolean;
    urgentAlerts: boolean;
    promotions: boolean;
  };
}

export const DonorSchema = SchemaFactory.createForClass(Donor);

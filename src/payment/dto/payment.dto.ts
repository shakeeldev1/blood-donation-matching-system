import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum PaymentType {
  BLOOD_PURCHASE = 'blood_purchase',
  DONATION_SUPPORT = 'donation_support',
  CAMPAIGN = 'campaign',
}

export class CreatePaymentIntentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  amount: number;

  @IsString()
  currency: string;

  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  units?: number;

  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ConfirmPaymentDto {
  @IsString()
  paymentIntentId: string;

  @IsString()
  paymentMethodId: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class WebhookEventDto {
  id: string;
  type: string;
  data: Record<string, any>;
}

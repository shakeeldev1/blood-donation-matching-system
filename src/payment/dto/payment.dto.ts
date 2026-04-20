import { IsNumber, IsString, IsEnum, IsOptional, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsNumber()
  @Min(50)
  amount: number;

  @IsString()
  currency: string;

  @IsEnum(['blood_purchase', 'donation_support', 'campaign'])
  paymentType: string;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsNumber()
  units?: number;

  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class ConfirmPaymentDto {
  @IsString()
  paymentIntentId: string;

  @IsString()
  paymentMethodId: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class WebhookEventDto {
  id: string;
  type: string;
  data: Record<string, any>;
}

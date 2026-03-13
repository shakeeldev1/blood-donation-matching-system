import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBloodRequestDto {
  @IsString()
  @IsOptional()
  patientName?: string;

  @IsString()
  @IsNotEmpty()
  hospital!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsEnum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  units!: number;

  @IsEnum(['Critical', 'High', 'Moderate'])
  @IsOptional()
  urgency?: 'Critical' | 'High' | 'Moderate';

  @IsString()
  @IsNotEmpty()
  contact!: string;

  @IsNumber()
  @Min(0.1)
  @Type(() => Number)
  @IsOptional()
  distanceKm?: number;
}
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDonorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsEnum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  @IsOptional()
  bloodGroup?: string;

  @IsEnum(['Blood', 'Plasma', 'Organ'])
  @IsOptional()
  donationType?: string;

  @IsNumber()
  @Min(18)
  @Max(65)
  @Type(() => Number)
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  weight?: string;

  @IsString()
  @IsOptional()
  height?: string; // in cm

  @IsNumber()
  @Min(10)
  @Max(60)
  @Type(() => Number)
  @IsOptional()
  bmi?: number; // Auto-calculated or user-provided

  @IsEnum(['Male', 'Female', 'Other'])
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  medicalConditions?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{1,3}\/\d{1,3}$/, { message: 'Blood pressure must be in format: 120/80' })
  bloodPressure?: string; // Format: 120/80

  @IsNumber()
  @Min(7)
  @Max(20)
  @Type(() => Number)
  @IsOptional()
  hemoglobinLevel?: number; // in g/dL

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in format: YYYY-MM-DD' })
  lastHealthCheckup?: string;

  @IsBoolean()
  @IsOptional()
  hasTattooOrPiercing?: boolean;

  @IsString()
  @IsOptional()
  tattooOrPiercingDetails?: string;

  @IsString()
  @IsOptional()
  currentMedications?: string;

  @IsString()
  @IsOptional()
  allergies?: string;

  @IsString()
  @IsOptional()
  dietaryRestrictions?: string;

  @IsString()
  @IsOptional()
  lastDonation?: string;

  @IsBoolean()
  @IsOptional()
  availability?: boolean;

  @IsEnum(['Free', 'Paid'])
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  serviceFee?: number; // Donation service fee in currency units (e.g., USD)

  @IsString()
  @IsOptional()
  image?: string;
}

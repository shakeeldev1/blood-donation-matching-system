import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDonorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsEnum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup!: string;

  @IsEnum(['Blood', 'Plasma', 'Organ'])
  donationType!: string;

  @IsNumber()
  @Min(18)
  @Max(65)
  @Type(() => Number)
  age!: number;

  @IsString()
  @IsNotEmpty()
  weight!: string;

  @IsString()
  @IsOptional()
  height?: string; // in cm

  @IsNumber()
  @IsOptional()
  @Min(10)
  @Max(60)
  @Type(() => Number)
  bmi?: number; // Auto-calculated or user-provided

  @IsEnum(['Male', 'Female', 'Other'])
  gender!: string;

  @IsString()
  @IsOptional()
  medicalConditions?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{1,3}\/\d{1,3}$/, {
    message: 'Blood pressure must be in format: 120/80',
  })
  bloodPressure?: string; // Format: 120/80

  @IsNumber()
  @IsOptional()
  @Min(7)
  @Max(20)
  @Type(() => Number)
  hemoglobinLevel?: number; // in g/dL

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in format: YYYY-MM-DD',
  })
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

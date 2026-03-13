import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
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

  @IsEnum(['Male', 'Female', 'Other'])
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  medicalConditions?: string;

  @IsString()
  @IsOptional()
  lastDonation?: string;

  @IsBoolean()
  @IsOptional()
  availability?: boolean;

  @IsEnum(['Free', 'Paid'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  image?: string;
}

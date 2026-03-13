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

  @IsEnum(['Male', 'Female', 'Other'])
  gender!: string;

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

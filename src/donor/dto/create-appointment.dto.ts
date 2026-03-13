import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  hospital!: string;

  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  time!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsEnum(['Whole Blood', 'Platelets', 'Plasma', 'Organ'])
  type!: 'Whole Blood' | 'Platelets' | 'Plasma' | 'Organ';
}
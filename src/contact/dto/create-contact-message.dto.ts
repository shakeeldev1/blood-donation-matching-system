import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MaxLength(180)
  subject!: string;

  @IsString()
  @MaxLength(4000)
  message!: string;
}

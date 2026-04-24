import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AskChatbotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @IsString()
  @IsOptional()
  sessionId?: string;
}

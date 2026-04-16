import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsArray()
  @IsOptional()
  attachments?: string[];
}

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsNotEmpty()
  participants!: string[];

  @IsString()
  @IsNotEmpty()
  type!: 'private' | 'group' | 'support';

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}

export class LeaveRoomDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}

export class MarkAsReadDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsArray()
  @IsOptional()
  messageIds?: string[];
}

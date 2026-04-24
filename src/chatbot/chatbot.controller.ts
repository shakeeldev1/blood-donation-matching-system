import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
import { ChatbotService } from './chatbot.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

type ChatbotJwtUser = {
  sub: string;
  email: string;
  name: string;
  role: string;
};

type ChatbotRequest = Request & {
  user?: ChatbotJwtUser | null;
};

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('ask')
  ask(@Body() dto: AskChatbotDto, @Req() req: ChatbotRequest) {
    return this.chatbotService.ask(dto, req.user ?? null);
  }
}

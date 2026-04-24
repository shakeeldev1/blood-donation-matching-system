import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { Donor, DonorSchema } from '../donor/schemas/donor.schema';
import {
  BloodRequest,
  BloodRequestSchema,
} from '../donor/schemas/blood-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donor.name, schema: DonorSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
    ]),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}

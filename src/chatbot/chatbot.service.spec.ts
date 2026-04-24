import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { ChatbotService } from './chatbot.service';

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: getModelToken('Donor'),
          useValue: {
            countDocuments: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
          },
        },
        {
          provide: getModelToken('BloodRequest'),
          useValue: {
            countDocuments: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
          },
        },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

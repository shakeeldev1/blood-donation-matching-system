import { Test, TestingModule } from '@nestjs/testing';
import { MailModuleService } from './mail-module.service';

describe('MailModuleService', () => {
  let service: MailModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailModuleService],
    }).compile();

    service = module.get<MailModuleService>(MailModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

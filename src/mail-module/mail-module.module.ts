import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModuleService } from './mail-module.service';

@Module({
  imports: [ConfigModule],
  providers: [MailModuleService],
  exports: [MailModuleService],
})
export class MailModuleModule {}

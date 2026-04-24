import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MailModuleModule } from './mail-module/mail-module.module';
import { ConfigModule } from '@nestjs/config';
import { DonorModule } from './donor/donor.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { PaymentModule } from './payment/payment.module';
import { ChatbotModule } from './chatbot/chatbot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      process.env.DB_URL ?? 'mongodb://localhost:27017/blood-donation',
    ),
    UserModule,
    AuthModule,
    MailModuleModule,
    DonorModule,
    AdminModule,
    ChatModule,
    PaymentModule,
    ChatbotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

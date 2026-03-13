import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MailModuleModule } from './mail-module/mail-module.module';
import { ConfigModule } from '@nestjs/config';
import { DonorModule } from './donor/donor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot('mongodb://localhost:27017/blood-donation'),
    UserModule,
    AuthModule,
    MailModuleModule,
    DonorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

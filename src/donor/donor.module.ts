import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DonorController } from './donor.controller';
import { DonorService } from './donor.service';
import { Donor, DonorSchema } from './schemas/donor.schema';
import {
  DonorAppointment,
  DonorAppointmentSchema,
} from './schemas/donor-appointment.schema';
import {
  BloodRequest,
  BloodRequestSchema,
} from './schemas/blood-request.schema';
import { MailModuleModule } from '../mail-module/mail-module.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donor.name, schema: DonorSchema },
      { name: DonorAppointment.name, schema: DonorAppointmentSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
    ]),
    MailModuleModule,
  ],
  controllers: [DonorController],
  providers: [DonorService],
  exports: [DonorService],
})
export class DonorModule {}

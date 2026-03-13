import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DonorController } from './donor.controller';
import { DonorService } from './donor.service';
import { Donor, DonorSchema } from './schemas/donor.schema';
import {
  DonorAppointment,
  DonorAppointmentSchema,
} from './schemas/donor-appointment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donor.name, schema: DonorSchema },
      { name: DonorAppointment.name, schema: DonorAppointmentSchema },
    ]),
  ],
  controllers: [DonorController],
  providers: [DonorService],
  exports: [DonorService],
})
export class DonorModule {}

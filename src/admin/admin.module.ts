import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Donor, DonorSchema } from '../donor/schemas/donor.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import {
  AdminRequest,
  AdminRequestSchema,
} from './schemas/admin-request.schema';
import {
  AdminComplaint,
  AdminComplaintSchema,
} from './schemas/admin-complaint.schema';
import {
  AdminRecipient,
  AdminRecipientSchema,
} from './schemas/admin-recipient.schema';
import {
  AdminInventory,
  AdminInventorySchema,
} from './schemas/admin-inventory.schema';
import {
  AdminCampaign,
  AdminCampaignSchema,
} from './schemas/admin-campaign.schema';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donor.name, schema: DonorSchema },
      { name: User.name, schema: UserSchema },
      { name: AdminRequest.name, schema: AdminRequestSchema },
      { name: AdminComplaint.name, schema: AdminComplaintSchema },
      { name: AdminRecipient.name, schema: AdminRecipientSchema },
      { name: AdminInventory.name, schema: AdminInventorySchema },
      { name: AdminCampaign.name, schema: AdminCampaignSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
})
export class AdminModule {}

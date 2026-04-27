import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('campaigns')
export class CampaignPublicController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getCampaigns(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.adminService.getCampaigns(parseInt(page, 10), parseInt(limit, 10));
  }

  @Get(':id')
  async getCampaignById(@Param('id') id: string) {
    const campaign = await this.adminService.getCampaignById(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return { campaign };
  }

  @Post(':id/join')
  async joinCampaign(@Param('id') id: string) {
    const campaign = await this.adminService.joinCampaign(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return { success: true, campaign };
  }
}

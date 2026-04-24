import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('complaints')
  async getComplaints(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getComplaints(parseInt(page), parseInt(limit));
  }

  @Get('reports')
  async getReports(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getReports(parseInt(page), parseInt(limit));
  }

  @Get('reports/export')
  async exportReports(@Query('format') format: 'json' | 'csv' = 'json') {
    return this.adminService.exportReports(format);
  }

  @Get('donors')
  async getDonors(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getDonors(parseInt(page), parseInt(limit));
  }

  @Post('donors')
  async createDonor(
    @Body()
    body: {
      name: string;
      email: string;
      phone: string;
      bloodType: string;
      city?: string;
      address?: string;
    },
  ) {
    return this.adminService.createDonor(body);
  }

  @Patch('donors/:id')
  async updateDonor(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      email?: string;
      phone?: string;
      bloodType?: string;
      city?: string;
      address?: string;
      status?: 'Active' | 'Inactive';
    },
  ) {
    const donor = await this.adminService.updateDonor(id, body);
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    return donor;
  }

  @Patch('donors/:id/status')
  async toggleDonorStatus(@Param('id') id: string) {
    const donor = await this.adminService.toggleDonorStatus(id);
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    return donor;
  }

  @Delete('donors/:id')
  async deleteDonor(@Param('id') id: string) {
    const result = await this.adminService.deleteDonor(id);
    if (!result.deleted) {
      throw new NotFoundException('Donor not found');
    }

    return result;
  }

  @Get('requests')
  async getRequests(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getRequests(parseInt(page), parseInt(limit));
  }

  @Post('requests')
  async createRequest(
    @Body()
    body: {
      patient: string;
      hospital: string;
      bloodType: string;
      quantity: number;
      urgency: string;
      phone?: string;
      reason?: string;
    },
  ) {
    return this.adminService.createRequest(body);
  }

  @Patch('requests/:id')
  async updateRequest(
    @Param('id') id: string,
    @Body()
    body: {
      patient?: string;
      hospital?: string;
      bloodType?: string;
      quantity?: number;
      urgency?: string;
      phone?: string;
      reason?: string;
    },
  ) {
    const request = await this.adminService.updateRequest(id, body);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  @Patch('requests/:id/status')
  async updateRequestStatus(
    @Param('id') id: string,
    @Body() body: { status: 'Pending' | 'Approved' | 'Rejected' },
  ) {
    const request = await this.adminService.updateRequestStatus(
      id,
      body.status,
    );
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  @Delete('requests/:id')
  async deleteRequest(@Param('id') id: string) {
    const result = await this.adminService.deleteRequest(id);
    if (!result.deleted) {
      throw new NotFoundException('Request not found');
    }

    return result;
  }

  @Get('recipients')
  async getRecipients(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getRecipients(parseInt(page), parseInt(limit));
  }

  @Post('recipients')
  async createRecipient(
    @Body()
    body: {
      name: string;
      age?: number;
      gender?: string;
      bloodType: string;
      hospital: string;
      city?: string;
      phone?: string;
      status?: 'Active' | 'Inactive';
    },
  ) {
    return this.adminService.createRecipient(body);
  }

  @Patch('recipients/:id')
  async updateRecipient(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      age?: number;
      gender?: string;
      bloodType?: string;
      hospital?: string;
      city?: string;
      phone?: string;
      status?: 'Active' | 'Inactive';
    },
  ) {
    const recipient = await this.adminService.updateRecipient(id, body);
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    return recipient;
  }

  @Patch('recipients/:id/status')
  async toggleRecipientStatus(@Param('id') id: string) {
    const recipient = await this.adminService.toggleRecipientStatus(id);
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    return recipient;
  }

  @Delete('recipients/:id')
  async deleteRecipient(@Param('id') id: string) {
    const result = await this.adminService.deleteRecipient(id);
    if (!result.deleted) {
      throw new NotFoundException('Recipient not found');
    }

    return result;
  }

  @Get('campaigns')
  async getCampaigns(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getCampaigns(parseInt(page), parseInt(limit));
  }

  @Get('inventory')
  async getInventory() {
    return this.adminService.getInventory();
  }

  @Patch('inventory/:bloodType')
  async adjustInventoryUnits(
    @Param('bloodType') bloodType: string,
    @Body() body: { delta: number },
  ) {
    const inventory = await this.adminService.adjustInventoryUnits(
      bloodType,
      body.delta,
    );
    if (!inventory) {
      throw new NotFoundException('Blood type not found in inventory');
    }

    return inventory;
  }

  @Patch('complaints/:id/status')
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body()
    body: { status: 'Pending' | 'Resolved' | 'Rejected'; resolution?: string },
  ) {
    const complaint = await this.adminService.updateComplaintStatus(id, body);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return complaint;
  }

  @Delete('complaints/:id')
  async deleteComplaint(@Param('id') id: string) {
    const result = await this.adminService.deleteComplaint(id);
    if (!result.deleted) {
      throw new NotFoundException('Complaint not found');
    }

    return result;
  }

  @Get('notifications')
  async getNotifications() {
    return this.adminService.getNotifications();
  }
}

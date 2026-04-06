import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
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
  async getComplaints(@Query('page') page: string = '1', @Query('limit') limit: string = '10') {
    return this.adminService.getComplaints(parseInt(page), parseInt(limit));
  }

  @Get('reports')
  async getReports(@Query('page') page: string = '1', @Query('limit') limit: string = '10') {
    return this.adminService.getReports(parseInt(page), parseInt(limit));
  }

  @Get('donors')
  async getDonors(@Query('page') page: string = '1', @Query('limit') limit: string = '10') {
    return this.adminService.getDonors(parseInt(page), parseInt(limit));
  }

  @Get('requests')
  async getRequests(@Query('page') page: string = '1', @Query('limit') limit: string = '10') {
    return this.adminService.getRequests(parseInt(page), parseInt(limit));
  }

  @Get('recipients')
  async getRecipients(@Query('page') page: string = '1', @Query('limit') limit: string = '10') {
    return this.adminService.getRecipients(parseInt(page), parseInt(limit));
  }

  @Get('campaigns')
  async getCampaigns(@Query('page') page: string = '1', @Query('limit') limit: string = '10') {
    return this.adminService.getCampaigns(parseInt(page), parseInt(limit));
  }

  @Get('inventory')
  async getInventory() {
    return this.adminService.getInventory();
  }

  @Get('notifications')
  async getNotifications() {
    return this.adminService.getNotifications();
  }
}

import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('experts')
export class ExpertsPublicController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getExperts() {
    return this.adminService.getPublicExperts();
  }
}

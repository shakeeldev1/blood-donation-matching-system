import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('reviews')
export class ReviewsPublicController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getApprovedReviews(@Query('limit') limit: string = '12') {
    return this.adminService.getPublicReviews(parseInt(limit, 10));
  }

  @Post()
  async submitReview(
    @Body()
    body: {
      name: string;
      email?: string;
      rating: number;
      text: string;
      location?: string;
      type?: string;
    },
  ) {
    return this.adminService.submitReview(body);
  }
}

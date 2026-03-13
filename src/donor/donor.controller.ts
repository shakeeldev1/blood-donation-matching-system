import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DonorService } from './donor.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

interface JwtUser {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface AuthRequest {
  user: JwtUser;
}

@Controller('donors')
export class DonorController {
  constructor(private readonly donorService: DonorService) {}

  // Public — returns all donors without sensitive fields
  @Get()
  getAll() {
    return this.donorService.findAll();
  }

  // Protected — returns the authenticated user's full donor profile
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMyProfile(@Req() req: AuthRequest) {
    return this.donorService.findByUserId(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('dashboard')
  getDashboard(@Req() req: AuthRequest) {
    return this.donorService.getDashboard(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('appointments')
  getAppointments(@Req() req: AuthRequest) {
    return this.donorService.getAppointments(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('appointments')
  createAppointment(@Req() req: AuthRequest, @Body() dto: CreateAppointmentDto) {
    return this.donorService.createAppointment(req.user.sub, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('appointments/:appointmentId/cancel')
  cancelAppointment(
    @Req() req: AuthRequest,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.donorService.cancelAppointment(req.user.sub, appointmentId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('history')
  getHistory(@Req() req: AuthRequest) {
    return this.donorService.getHistory(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('requests')
  getRequests(@Req() req: AuthRequest) {
    return this.donorService.getRequests(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('settings')
  getSettings(@Req() req: AuthRequest) {
    return this.donorService.getSettings(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('settings')
  updateSettings(
    @Req() req: AuthRequest,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.donorService.updateSettings(req.user.sub, dto);
  }

  // Protected — registers the authenticated user as a donor
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateDonorDto) {
    return this.donorService.create(req.user.sub, dto, {
      name: req.user.name,
      email: req.user.email,
    });
  }

  // Protected — updates the authenticated user's donor profile
  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  update(@Req() req: AuthRequest, @Body() dto: UpdateDonorDto) {
    return this.donorService.updateByUserId(req.user.sub, dto, {
      name: req.user.name,
      email: req.user.email,
    });
  }
}

import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DonorService } from './donor.service';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';

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

  // Protected — registers the authenticated user as a donor
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateDonorDto) {
    return this.donorService.create(req.user.sub, dto);
  }

  // Protected — updates the authenticated user's donor profile
  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  update(@Req() req: AuthRequest, @Body() dto: UpdateDonorDto) {
    return this.donorService.updateByUserId(req.user.sub, dto);
  }
}

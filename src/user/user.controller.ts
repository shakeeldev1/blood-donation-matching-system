import {
  Body,
  Controller,
  Delete,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserService } from './user.service';
import { DonorService } from 'src/donor/donor.service';

interface JwtUser {
  sub: string;
}

interface AuthRequest {
  user: JwtUser;
}

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly donorService: DonorService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Patch('password')
  changePassword(@Req() req: AuthRequest, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('me')
  async deleteAccount(@Req() req: AuthRequest) {
    await this.donorService.deleteByUserId(req.user.sub);
    return this.userService.deleteAccount(req.user.sub);
  }
}

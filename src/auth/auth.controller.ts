import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/sendOtp.dto';
import { VerifyOtpDto } from './dto/verifyOtp.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

interface AuthRequest {
  user: {
    sub: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMyProfile(@Req() req) {
    return req.user;
  }

  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.email);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.userId, dto.refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  logout(@Req() req: AuthRequest) {
    return this.authService.logout(req.user.sub);
  }
}

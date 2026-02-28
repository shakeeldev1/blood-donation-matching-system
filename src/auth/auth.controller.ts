import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/sendOtp.dto';
import { VerifyOtpDto } from './dto/verifyOtp.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

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
}

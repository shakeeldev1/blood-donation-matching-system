// auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { MailModuleService } from 'src/mail-module/mail-module.service';

@Injectable()
export class AuthService {
  private otpStore = new Map<
    string,
    { otp: string; expiresAt: number; isVerified: boolean }
  >();

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailModuleService: MailModuleService,
  ) {}

  // ================= OTP =================
  async sendOtp(email: string) {
    const normalizedEmail = email.toLowerCase();
    const existingUser = await this.userService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const otp = this.generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    this.otpStore.set(normalizedEmail, {
      otp,
      expiresAt,
      isVerified: false,
    });

    await this.mailModuleService.sendOtpEmail(normalizedEmail, otp);
    return { message: 'OTP sent to email' };
  }

  async verifyOtp(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase();
    const otpRecord = this.otpStore.get(normalizedEmail);

    if (!otpRecord) {
      throw new BadRequestException('OTP not found. Please request a new one');
    }

    if (Date.now() > otpRecord.expiresAt) {
      this.otpStore.delete(normalizedEmail);
      throw new BadRequestException('OTP expired. Please request a new one');
    }

    if (otpRecord.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    this.otpStore.set(normalizedEmail, {
      ...otpRecord,
      isVerified: true,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return { message: 'Email verified successfully' };
  }

  // ================= SIGNUP =================
  async signup(dto: SignupDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const otpRecord = this.otpStore.get(normalizedEmail);

    if (!otpRecord || !otpRecord.isVerified) {
      throw new BadRequestException('Please verify your email with OTP first');
    }

    if (Date.now() > otpRecord.expiresAt) {
      this.otpStore.delete(normalizedEmail);
      throw new BadRequestException(
        'Email verification expired. Please verify again',
      );
    }

    const existingUser = await this.userService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.createUser({
      name: dto.name,
      email: normalizedEmail,
      password: hashedPassword,
    });
    this.otpStore.delete(normalizedEmail);
    const tokens = await this.generateTokens(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  // ================= LOGIN =================
  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.generateTokens(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  // ================= REFRESH =================
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }
    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = await this.generateTokens(userId);
    await this.storeRefreshToken(userId, tokens.refresh_token);
    return tokens;
  }

  // ================= LOGOUT =================
  async logout(userId: string) {
    await this.userService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  // ================= PRIVATE HELPERS =================

  private async generateTokens(userId: string) {
    const payload = { sub: userId };

    const accessSecret =
      this.configService.get<string>('JWT_SECRET') ??
      this.configService.get<string>('ACCESS_TOKEN_SECRET');
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('REFRESH_TOKEN_SECRET');

    if (!accessSecret || !refreshSecret) {
      throw new UnauthorizedException(
        'Token secrets are not configured. Set JWT_SECRET/ACCESS_TOKEN_SECRET and JWT_REFRESH_SECRET/REFRESH_TOKEN_SECRET.',
      );
    }

    const access_token = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: '15m',
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    return { access_token, refresh_token };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.userService.updateRefreshToken(userId, hashed);
  }

  private generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
